import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';

/**
 * The webhook and the client's own sync call both land in `reconcileOrder`,
 * usually within a second of each other. If that is not idempotent, a buyer
 * gets two sets of tickets for one payment — and the event is oversold by
 * exactly the number of people who paid.
 */

function makeFakes(opts: {
  orderStatus?: string;
  totalMinor?: number;
  intentStatus?: string;
  amountReceived?: number;
  orderUserId?: string | null;
  intentId?: string | null;
  createdAt?: Date;
  payableAccount?: string | null;
}) {
  const order = {
    id: 'ord1',
    userId: opts.orderUserId === undefined ? 'user1' : opts.orderUserId,
    status: opts.orderStatus ?? 'AWAITING_PAYMENT',
    totalMinor: opts.totalMinor ?? 9270,
    platformFeeMinor: 270,
    currency: 'GBP',
    organizationId: 'org1',
    createdAt: opts.createdAt ?? new Date(),
    stripePaymentIntentId: opts.intentId === undefined ? 'pi_1' : opts.intentId,
    event: { id: 'evt1', title: 'Leadership Conference' },
  };

  const intent = {
    id: 'pi_1',
    status: opts.intentStatus ?? 'succeeded',
    amount: order.totalMinor,
    amount_received: opts.amountReceived ?? order.totalMinor,
    currency: 'gbp',
    latest_charge: 'ch_1',
    client_secret: 'pi_1_secret_x',
    metadata: { orderId: 'ord1' },
    last_payment_error: null,
  };

  let issuedCalls = 0;
  let ticketsIssued = 0;
  const payments: Record<string, unknown>[] = [];

  const txLike = {
    order: {
      updateMany: async ({ where }: never) => {
        const w = where as { status: { in: string[] } };
        if (!w.status.in.includes(order.status)) return { count: 0 };
        order.status = 'PAID';
        return { count: 1 };
      },
      findUniqueOrThrow: async () => order,
      update: async () => order,
    },
    payment: { upsert: async ({ create }: never) => { payments.push(create as never); return {}; } },
    ticket: {
      updateMany: async () => {
        issuedCalls += 1;
        // Mirrors the real guard: only RESERVED rows move to ISSUED, so a
        // second pass finds none.
        const n = ticketsIssued === 0 ? 3 : 0;
        ticketsIssued += n;
        return { count: n };
      },
      count: async () => ticketsIssued,
    },
  };

  const prisma = {
    order: { findUnique: async () => order, update: async () => order, findUniqueOrThrow: async () => order },
    ticket: { count: async () => ticketsIssued },
    payment: { upsert: async () => ({}), findUnique: async () => null, update: async () => ({}) },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(txLike),
  };

  const stripe = {
    isConfigured: true,
    publishableKey: 'pk_test_x',
    client: {
      paymentIntents: {
        retrieve: async () => intent,
        create: async () => intent,
      },
    },
  };

  const connect = {
    payableAccountFor: async () =>
      opts.payableAccount === undefined ? 'acct_live' : opts.payableAccount,
  };
  const svc = new PaymentsService(prisma as never, stripe as never, connect as never, {
    write: async () => undefined,
  } as never);

  return { svc, order, intent, state: () => ({ issuedCalls, ticketsIssued, payments }) };
}

describe('PaymentsService.reconcileOrder', () => {
  it('issues tickets once when the payment succeeded', async () => {
    const { svc, state } = makeFakes({});
    const r = await svc.reconcileOrder('ord1');
    expect(r).toEqual({ status: 'PAID', ticketsIssued: 3 });
    expect(state().ticketsIssued).toBe(3);
  });

  it('does not issue a second set when the webhook and the client both arrive', async () => {
    const { svc, state } = makeFakes({});
    const first = await svc.reconcileOrder('ord1');
    const second = await svc.reconcileOrder('ord1');
    expect(first.ticketsIssued).toBe(3);
    expect(second.ticketsIssued).toBe(3); // reports, does not re-issue
    expect(state().ticketsIssued).toBe(3);
  });

  it('survives both arriving at once', async () => {
    const { svc, state } = makeFakes({});
    const [a, b] = await Promise.all([svc.reconcileOrder('ord1'), svc.reconcileOrder('ord1')]);
    expect(state().ticketsIssued).toBe(3);
    expect(a.status).toBe('PAID');
    expect(b.status).toBe('PAID');
  });

  it('refuses to issue when Stripe took a different amount than the order says', async () => {
    // The case this guards: something edited the order after the intent was
    // created. Issuing here would hand over tickets at a price nobody agreed.
    const { svc, state } = makeFakes({ totalMinor: 9270, amountReceived: 100 });
    const r = await svc.reconcileOrder('ord1');
    expect(r.ticketsIssued).toBe(0);
    expect(state().ticketsIssued).toBe(0);
  });

  it('issues nothing while the intent is still unpaid', async () => {
    const { svc, state } = makeFakes({ intentStatus: 'requires_payment_method' });
    const r = await svc.reconcileOrder('ord1');
    expect(r.ticketsIssued).toBe(0);
    expect(state().ticketsIssued).toBe(0);
  });

  it('short-circuits an order that is already paid', async () => {
    const { svc, state } = makeFakes({ orderStatus: 'PAID' });
    const r = await svc.reconcileOrder('ord1');
    expect(r.status).toBe('PAID');
    expect(state().issuedCalls).toBe(0);
  });

  it('does nothing for an order that never reached Stripe', async () => {
    const { svc } = makeFakes({ intentId: null, orderStatus: 'PENDING' });
    const r = await svc.reconcileOrder('ord1');
    expect(r).toEqual({ status: 'PENDING', ticketsIssued: 0 });
  });
});

describe('PaymentsService.createIntentForOrder', () => {
  it('reuses the existing intent rather than opening a second one', async () => {
    // Two intents means two authorisations on the buyer's card, and only one
    // ever gets captured — the other sits pending on their statement.
    const { svc, intent } = makeFakes({ intentStatus: 'requires_payment_method' });
    const r = await svc.createIntentForOrder('user1', 'ord1');
    expect(r.clientSecret).toBe(intent.client_secret);
  });

  it('refuses an order belonging to someone else', async () => {
    const { svc } = makeFakes({ orderUserId: 'someone-else' });
    await expect(svc.createIntentForOrder('user1', 'ord1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an order that is already paid', async () => {
    const { svc } = makeFakes({ orderStatus: 'PAID' });
    await expect(svc.createIntentForOrder('user1', 'ord1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to open an intent when the organiser can no longer be paid', async () => {
    // An account can be restricted during the reservation window, after the
    // order was created against a healthy one.
    const { svc } = makeFakes({ intentId: null, payableAccount: null });
    await expect(svc.createIntentForOrder('user1', 'ord1')).rejects.toThrow(
      /cannot receive payments/i,
    );
  });

  it('refuses an order whose reservation has lapsed', async () => {
    const { svc } = makeFakes({ createdAt: new Date(Date.now() - 60 * 60 * 1000) });
    await expect(svc.createIntentForOrder('user1', 'ord1')).rejects.toThrow(/expired/i);
  });
});

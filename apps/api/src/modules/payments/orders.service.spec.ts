import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrdersService, RESERVATION_WINDOW_MS } from './orders.service.js';

/**
 * These cover the invariants where a bug costs real money or real seats:
 * overselling, taking a price from the client, and giving inventory back
 * twice. They run against a hand-rolled fake rather than a database, because
 * what is being checked is the shape of the guards — that the conditional
 * `updateMany` is what reserves, and that nothing trusts the request body.
 */

interface FakeTicketType {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  quantity: number;
  sold: number;
  perOrderMax: number;
  salesStart: Date | null;
  salesEnd: Date | null;
}

function makeFakes(opts: {
  types: FakeTicketType[];
  eventStatus?: string;
  endsAt?: Date;
  capacity?: number | null;
  attendeeCount?: number;
  /** null = the organiser cannot receive payouts. */
  payableAccount?: string | null;
}) {
  const types = opts.types.map((t) => ({ ...t }));
  const event = {
    id: 'evt1',
    organizationId: 'org1',
    status: opts.eventStatus ?? 'PUBLISHED',
    endsAt: opts.endsAt ?? new Date(Date.now() + 86_400_000),
    capacity: opts.capacity ?? null,
    attendeeCount: opts.attendeeCount ?? 0,
  };
  const createdOrders: Record<string, unknown>[] = [];
  const createdTickets: Record<string, unknown>[] = [];

  const tx = {
    event: {
      findUnique: async () => event,
      update: async ({ data }: never) => {
        const d = data as { attendeeCount?: { increment?: number } };
        event.attendeeCount += d.attendeeCount?.increment ?? 0;
        return event;
      },
      updateMany: async ({ where, data }: never) => {
        const w = where as { attendeeCount?: { lte: number } };
        const d = data as { attendeeCount: { increment: number } };
        if (w.attendeeCount && event.attendeeCount > w.attendeeCount.lte) return { count: 0 };
        event.attendeeCount += d.attendeeCount.increment;
        return { count: 1 };
      },
    },
    ticketType: {
      findMany: async ({ where }: never) => {
        const w = where as { id: { in: string[] }; eventId: string };
        return types.filter((t) => w.id.in.includes(t.id));
      },
      // The guard under test: only increments when `sold` is still low enough.
      updateMany: async ({ where, data }: never) => {
        const w = where as { id: string; sold: { lte: number } };
        const d = data as { sold: { increment: number } };
        const t = types.find((x) => x.id === w.id)!;
        if (t.sold > w.sold.lte) return { count: 0 };
        t.sold += d.sold.increment;
        return { count: 1 };
      },
    },
    order: {
      create: async ({ data }: never) => {
        const d = data as Record<string, unknown>;
        createdOrders.push(d);
        return { id: `ord${createdOrders.length}`, createdAt: new Date() };
      },
    },
    ticket: {
      create: async ({ data }: never) => {
        createdTickets.push(data as Record<string, unknown>);
        return {};
      },
    },
  };

  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const audit = { write: async () => undefined };

  const connect = {
    payableAccountFor: async () =>
      opts.payableAccount === undefined ? 'acct_live' : opts.payableAccount,
  };
  const svc = new OrdersService(prisma as never, audit as never, connect as never);
  return { svc, types, event, createdOrders, createdTickets };
}

const base: FakeTicketType = {
  id: 'tt1',
  name: 'General',
  priceMinor: 2500,
  currency: 'GBP',
  quantity: 10,
  sold: 0,
  perOrderMax: 10,
  salesStart: null,
  salesEnd: null,
};

describe('OrdersService.create', () => {
  afterEach(() => {
    delete process.env.PLATFORM_FEE_BPS;
  });

  it('prices the order from the database, not the request', async () => {
    const { svc } = makeFakes({ types: [base] });
    const quote = await svc.create('user1', {
      eventId: 'evt1',
      items: [{ ticketTypeId: 'tt1', quantity: 2 }],
      // All of these are attacker-supplied and must be ignored entirely.
      totalMinor: 1,
      subtotalMinor: 1,
      platformFeeMinor: 0,
      unitPriceMinor: 1,
      currency: 'USD',
    });
    expect(quote.subtotalMinor).toBe(5000);
    expect(quote.currency).toBe('GBP');
  });

  it('adds the platform fee on top, at the rate the design shows', async () => {
    // £90.00 + 3% = £92.70, per the handoff's checkout screen.
    const { svc } = makeFakes({ types: [{ ...base, priceMinor: 9000, quantity: 5 }] });
    const quote = await svc.create('user1', {
      eventId: 'evt1',
      items: [{ ticketTypeId: 'tt1', quantity: 1 }],
    });
    expect(quote.subtotalMinor).toBe(9000);
    expect(quote.platformFeeMinor).toBe(270);
    expect(quote.totalMinor).toBe(9270);
  });

  it('honours PLATFORM_FEE_BPS=0 rather than silently charging a fee', async () => {
    process.env.PLATFORM_FEE_BPS = '0';
    const { svc } = makeFakes({ types: [base] });
    const quote = await svc.create('user1', {
      eventId: 'evt1',
      items: [{ ticketTypeId: 'tt1', quantity: 1 }],
    });
    expect(quote.platformFeeMinor).toBe(0);
    expect(quote.totalMinor).toBe(2500);
  });

  it('rejects a nonsense fee rate at the point of use', async () => {
    process.env.PLATFORM_FEE_BPS = '-5';
    const { svc } = makeFakes({ types: [base] });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 1 }] }),
    ).rejects.toThrow(/PLATFORM_FEE_BPS/);
  });

  it('does not oversell when the last seats are already taken', async () => {
    const { svc, types } = makeFakes({ types: [{ ...base, quantity: 10, sold: 9 }] });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 2 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(types[0]!.sold).toBe(9); // untouched
  });

  it('sells the last seat exactly once across two racing orders', async () => {
    const { svc, types } = makeFakes({ types: [{ ...base, quantity: 1, sold: 0 }] });
    const order = { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 1 }] };
    const results = await Promise.allSettled([
      svc.create('user1', order),
      svc.create('user2', order),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    expect(types[0]!.sold).toBe(1);
  });

  it('counts duplicate line items together against perOrderMax', async () => {
    // 2 + 3 of the same type is 5, which must fail a max of 4 — splitting it
    // across two entries is the obvious way to walk past a naive check.
    const { svc } = makeFakes({ types: [{ ...base, perOrderMax: 4, quantity: 50 }] });
    await expect(
      svc.create('user1', {
        eventId: 'evt1',
        items: [
          { ticketTypeId: 'tt1', quantity: 2 },
          { ticketTypeId: 'tt1', quantity: 3 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to mix currencies in one order', async () => {
    const { svc } = makeFakes({
      types: [base, { ...base, id: 'tt2', name: 'VIP', currency: 'EUR' }],
    });
    await expect(
      svc.create('user1', {
        eventId: 'evt1',
        items: [
          { ticketTypeId: 'tt1', quantity: 1 },
          { ticketTypeId: 'tt2', quantity: 1 },
        ],
      }),
    ).rejects.toThrow(/mixes currencies/);
  });

  it('sends free tickets to RSVP instead of opening a zero-amount charge', async () => {
    const { svc } = makeFakes({ types: [{ ...base, priceMinor: 0 }] });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 1 }] }),
    ).rejects.toThrow(/free/i);
  });

  it('refuses tickets whose sales window has closed', async () => {
    const { svc } = makeFakes({
      types: [{ ...base, salesEnd: new Date(Date.now() - 1000) }],
    });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses an unpublished event', async () => {
    const { svc } = makeFakes({ types: [base], eventStatus: 'DRAFT' });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('respects event capacity as well as per-type stock', async () => {
    const { svc } = makeFakes({
      types: [{ ...base, quantity: 100 }],
      capacity: 5,
      attendeeCount: 4,
    });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 3 }] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to sell when the organiser cannot receive payouts', async () => {
    // Otherwise the money is taken onto the platform with no route onward:
    // a host's unfinished onboarding becomes our liability and the buyer's
    // problem. Nothing is reserved either — the refusal comes first.
    const { svc, types } = makeFakes({ types: [base], payableAccount: null });
    await expect(
      svc.create('user1', { eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 1 }] }),
    ).rejects.toThrow(/payouts/i);
    expect(types[0]!.sold).toBe(0);
  });

  it('reserves tickets rather than issuing them', async () => {
    const { svc, createdTickets } = makeFakes({ types: [base] });
    await svc.create('user1', {
      eventId: 'evt1',
      items: [{ ticketTypeId: 'tt1', quantity: 3 }],
    });
    expect(createdTickets).toHaveLength(3);
    for (const t of createdTickets) {
      expect(t.status).toBe('RESERVED');
      expect(t.issuedAt).toBeUndefined();
    }
  });

  it('quotes an expiry a reservation window ahead', async () => {
    const { svc } = makeFakes({ types: [base] });
    const before = Date.now();
    const quote = await svc.create('user1', {
      eventId: 'evt1',
      items: [{ ticketTypeId: 'tt1', quantity: 1 }],
    });
    const delta = quote.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(RESERVATION_WINDOW_MS - 5_000);
    expect(delta).toBeLessThanOrEqual(RESERVATION_WINDOW_MS + 5_000);
  });
});

describe('OrdersService.releaseExpired', () => {
  function sweeper(orderStatus: string) {
    const ticketTypes = [{ id: 'tt1', sold: 4 }];
    const event = { id: 'evt1', attendeeCount: 4 };
    let claimed = 0;
    const prisma = {
      order: {
        findMany: async () => [
          { id: 'ord1', eventId: 'evt1', items: [{ ticketTypeId: 'tt1', quantity: 4 }] },
        ],
      },
      $transaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          order: {
            updateMany: async () => {
              // Only the first caller finds it PENDING.
              if (orderStatus !== 'PENDING' || claimed > 0) return { count: 0 };
              claimed += 1;
              return { count: 1 };
            },
          },
          ticketType: {
            update: async ({ where, data }: never) => {
              const w = where as { id: string };
              const d = data as { sold: { decrement: number } };
              ticketTypes.find((t) => t.id === w.id)!.sold -= d.sold.decrement;
              return {};
            },
          },
          event: {
            update: async ({ data }: never) => {
              const d = data as { attendeeCount: { decrement: number } };
              event.attendeeCount -= d.attendeeCount.decrement;
              return {};
            },
          },
          ticket: { updateMany: async () => ({ count: 4 }) },
        }),
    };
    const svc = new OrdersService(
      prisma as never,
      { write: async () => undefined } as never,
      { payableAccountFor: async () => 'acct_live' } as never,
    );
    return { svc, ticketTypes, event };
  }

  it('gives the seats back when a checkout is abandoned', async () => {
    const { svc, ticketTypes, event } = sweeper('PENDING');
    const n = await svc.releaseExpired();
    expect(n).toBe(1);
    expect(ticketTypes[0]!.sold).toBe(0);
    expect(event.attendeeCount).toBe(0);
  });

  it('does not give the same seats back twice', async () => {
    const { svc, ticketTypes } = sweeper('PENDING');
    await svc.releaseExpired();
    await svc.releaseExpired(); // second sweep finds nothing to claim
    expect(ticketTypes[0]!.sold).toBe(0);
  });

  it('leaves a paid order alone', async () => {
    const { svc, ticketTypes, event } = sweeper('PAID');
    const n = await svc.releaseExpired();
    expect(n).toBe(0);
    expect(ticketTypes[0]!.sold).toBe(4);
    expect(event.attendeeCount).toBe(4);
  });
});

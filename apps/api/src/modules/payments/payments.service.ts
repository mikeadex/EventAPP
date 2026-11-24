import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { StripeService } from './stripe.service.js';
import { ConnectService } from './connect.service.js';
import { RESERVATION_WINDOW_MS } from './orders.service.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly connect: ConnectService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Create (or re-fetch) the PaymentIntent for an order.
   *
   * Idempotent on purpose: a retry, a backgrounded app, or a second tap must
   * return the SAME intent rather than opening another one. Two intents for
   * one order means two authorisations against the buyer's card, and only one
   * of them is ever captured — the other sits as a pending charge on their
   * statement for days.
   */
  async createIntentForOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        totalMinor: true,
        platformFeeMinor: true,
        currency: true,
        createdAt: true,
        organizationId: true,
        stripePaymentIntentId: true,
        event: { select: { id: true, title: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) {
      throw new ForbiddenException('This order belongs to someone else');
    }
    if (order.status === 'PAID') {
      throw new ConflictException('This order has already been paid');
    }
    if (order.status !== 'PENDING' && order.status !== 'AWAITING_PAYMENT') {
      throw new ConflictException(`This order is ${order.status.toLowerCase()}`);
    }
    if (order.createdAt.getTime() + RESERVATION_WINDOW_MS < Date.now()) {
      throw new ConflictException('This order has expired — please start again');
    }

    if (order.stripePaymentIntentId) {
      const existing = await this.stripe.client.paymentIntents.retrieve(
        order.stripePaymentIntentId,
      );
      // Only reuse one that can still be paid. A cancelled intent cannot, so
      // fall through and open a fresh one.
      if (existing.status !== 'canceled') {
        return this.intentResponse(existing, order.totalMinor, order.currency);
      }
    }

    // Where the money is going. Null means the organiser cannot be paid, and
    // the order should never have been created — `OrdersService` checks the
    // same thing first. Checked again here because this is the call that
    // actually moves money, and an order can sit for its whole reservation
    // window while an account is restricted underneath it.
    const destination = await this.connect.payableAccountFor(order.organizationId);
    if (!destination) {
      throw new ConflictException(
        'This host cannot receive payments right now, so the order cannot be paid. ' +
          'Nothing has been charged.',
      );
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.createIntent(order, destination);
    } catch (err) {
      // Our `payoutStatus` column is a cache of Stripe's view and can lag it —
      // an account can lose a capability after the order was created. Stripe
      // says so in its own vocabulary ("needs the following capabilities
      // enabled: transfers"), which means nothing to a buyer. Translate it,
      // and correct the column so the next person is refused earlier.
      const message = (err as Error)?.message ?? '';
      if (/capabilit|destination account/i.test(message)) {
        this.logger.error(
          `Order ${order.id}: destination ${destination} cannot receive transfers — ` +
            `marking the organisation as not payable. (${message})`,
        );
        await this.prisma.organization
          .update({ where: { id: order.organizationId }, data: { payoutStatus: 'ONBOARDING' } })
          .catch(() => undefined);
        throw new ConflictException(
          'This host cannot receive payments yet, so the order cannot be paid. ' +
            'Nothing has been charged.',
        );
      }
      throw err;
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'AWAITING_PAYMENT', stripePaymentIntentId: intent.id },
    });

    return this.intentResponse(intent, order.totalMinor, order.currency);
  }

  /** The PaymentIntent itself, split out so the caller can translate failures. */
  private createIntent(
    order: {
      id: string;
      totalMinor: number;
      platformFeeMinor: number;
      currency: string;
      organizationId: string;
      event: { id: string; title: string };
    },
    destination: string,
  ) {
    return this.stripe.client.paymentIntents.create(
      {
        amount: order.totalMinor,
        currency: order.currency.toLowerCase(),
        // Lets Stripe present Apple Pay / Google Pay where available, which is
        // what the design's checkout sheet shows.
        automatic_payment_methods: { enabled: true },
        // A destination charge: the whole amount is taken on the platform and
        // the ticket money is transferred to the organiser, leaving only the
        // platform fee behind. Without this every payment stayed in the
        // platform account with no route onward — taken correctly and stuck.
        transfer_data: { destination },
        application_fee_amount: order.platformFeeMinor,
        metadata: {
          orderId: order.id,
          eventId: order.event.id,
          organizationId: order.organizationId,
        },
        description: `Tickets — ${order.event.title}`,
      },
      // Stripe-side idempotency, in case two requests race past the check
      // above. Keyed on the order so the second request gets the first's
      // intent rather than creating a twin.
      { idempotencyKey: `order_intent_${order.id}` },
    );
  }

  private intentResponse(intent: Stripe.PaymentIntent, amountMinor: number, currency: string) {
    const publishableKey = this.stripe.publishableKey;
    if (!publishableKey) {
      // Without it the client cannot initialise Stripe, and a clientSecret
      // alone is useless — better to say so than to hand over half a payment.
      throw new BadRequestException(
        'Payments are misconfigured on this server (no publishable key).',
      );
    }
    return {
      clientSecret: intent.client_secret,
      publishableKey,
      amountMinor,
      currency,
      status: intent.status,
    };
  }

  /**
   * Bring our records in line with Stripe's for one order.
   *
   * Called from two places: the webhook (primary) and the client after it
   * confirms (backstop). Webhooks are not guaranteed to be prompt and are not
   * guaranteed to arrive at all — if the only path to issuing a ticket runs
   * through one, a dropped delivery means a buyer who paid and got nothing.
   *
   * Idempotent: the state change is a conditional `updateMany`, so whichever
   * caller arrives second changes nothing.
   */
  async reconcileOrder(orderId: string): Promise<{ status: string; ticketsIssued: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        totalMinor: true,
        platformFeeMinor: true,
        currency: true,
        organizationId: true,
        userId: true,
        stripePaymentIntentId: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'PAID') {
      const n = await this.prisma.ticket.count({
        where: { orderId: order.id, status: { in: ['ISSUED', 'CHECKED_IN'] } },
      });
      return { status: 'PAID', ticketsIssued: n };
    }
    if (!order.stripePaymentIntentId) {
      return { status: order.status, ticketsIssued: 0 };
    }

    const intent = await this.stripe.client.paymentIntents.retrieve(order.stripePaymentIntentId);

    if (intent.status === 'succeeded') {
      // Trust Stripe's amount, not ours: if they diverge, something changed
      // the order after the intent was created and we must not issue tickets
      // for a price nobody agreed to.
      if (intent.amount_received !== order.totalMinor) {
        this.logger.error(
          `Order ${order.id}: Stripe received ${intent.amount_received} but the order totals ` +
            `${order.totalMinor}. Not issuing tickets.`,
        );
        return { status: order.status, ticketsIssued: 0 };
      }
      return this.markPaid(order.id, intent);
    }

    if (intent.status === 'canceled' || intent.last_payment_error) {
      await this.recordFailure(order.id, intent);
    }
    return { status: order.status, ticketsIssued: 0 };
  }

  /** Move an order to PAID and turn its reservations into real tickets. */
  private async markPaid(orderId: string, intent: Stripe.PaymentIntent) {
    return this.prisma.$transaction(async (tx) => {
      // The guard that makes this safe to run twice.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['PENDING', 'AWAITING_PAYMENT'] } },
        data: { status: 'PAID' },
      });
      if (claimed.count === 0) {
        const n = await tx.ticket.count({
          where: { orderId, status: { in: ['ISSUED', 'CHECKED_IN'] } },
        });
        return { status: 'PAID', ticketsIssued: n };
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          totalMinor: true,
          platformFeeMinor: true,
          currency: true,
        },
      });

      const charge =
        typeof intent.latest_charge === 'string'
          ? intent.latest_charge
          : (intent.latest_charge?.id ?? null);

      await tx.payment.upsert({
        where: { stripePaymentIntentId: intent.id },
        create: {
          orderId: order.id,
          organizationId: order.organizationId,
          amountMinor: intent.amount_received,
          currency: order.currency,
          platformFeeMinor: order.platformFeeMinor,
          status: 'SUCCEEDED',
          stripePaymentIntentId: intent.id,
          stripeChargeId: charge,
        },
        update: { status: 'SUCCEEDED', stripeChargeId: charge },
      });

      const issued = await tx.ticket.updateMany({
        where: { orderId: order.id, status: 'RESERVED' },
        data: { status: 'ISSUED', issuedAt: new Date() },
      });

      await this.audit.write({
        actorUserId: order.userId ?? undefined,
        organizationId: order.organizationId,
        action: 'order.paid',
        targetType: 'order',
        targetId: order.id,
        metadata: {
          amountMinor: intent.amount_received,
          currency: order.currency,
          stripePaymentIntentId: intent.id,
        } as Prisma.InputJsonValue,
        tx,
      });

      this.logger.log(`Order ${order.id} paid — ${issued.count} ticket(s) issued`);
      return { status: 'PAID', ticketsIssued: issued.count };
    });
  }

  private async recordFailure(orderId: string, intent: Stripe.PaymentIntent) {
    const reason = intent.last_payment_error?.message ?? `Intent ${intent.status}`;
    try {
      await this.prisma.payment.upsert({
        where: { stripePaymentIntentId: intent.id },
        create: {
          orderId,
          organizationId: (
            await this.prisma.order.findUniqueOrThrow({
              where: { id: orderId },
              select: { organizationId: true },
            })
          ).organizationId,
          amountMinor: intent.amount,
          currency: intent.currency.toUpperCase(),
          status: 'FAILED',
          stripePaymentIntentId: intent.id,
          failureReason: reason,
        },
        update: { status: 'FAILED', failureReason: reason },
      });
    } catch (err) {
      this.logger.error(`Could not record failure for ${orderId}: ${(err as Error).message}`);
    }
    // The order stays where it is. A declined card is retryable within the
    // reservation window, and cancelling here would hand the seats back
    // while the buyer is still reaching for another card.
  }

  /** Reconcile from a webhook, where the intent is already in hand. */
  async handleIntentEvent(intent: Stripe.PaymentIntent) {
    const orderId = intent.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(`PaymentIntent ${intent.id} has no orderId in metadata — ignoring`);
      return;
    }
    await this.reconcileOrder(orderId);
  }
}

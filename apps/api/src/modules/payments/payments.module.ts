import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Module,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StripeService } from './stripe.service.js';
import { OrdersService } from './orders.service.js';
import { PaymentsService } from './payments.service.js';
import { ConnectService } from './connect.service.js';
import { OrgMembershipGuard } from '../../common/org-membership.guard.js';
import { OrgScope, RequirePermissions } from '../../common/decorators.js';
import { Permission } from '@ekklesia/shared';

@Controller()
class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  /** Open a paid order and hold its tickets. */
  @Post('orders')
  @UseGuards(AuthGuard)
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.orders.create(req.user.id, body);
  }

  @Get('orders/:orderId')
  @UseGuards(AuthGuard)
  get(@Param('orderId') orderId: string, @Req() req: AuthedRequest) {
    return this.orders.getForUser(req.user.id, orderId);
  }

  /** The client secret the Stripe SDK needs to present the payment sheet. */
  @Post('orders/:orderId/payment-intent')
  @UseGuards(AuthGuard)
  intent(@Param('orderId') orderId: string, @Req() req: AuthedRequest) {
    return this.payments.createIntentForOrder(req.user.id, orderId);
  }

  /**
   * Ask the server to check with Stripe now.
   *
   * The client calls this straight after confirming, rather than waiting for
   * the webhook. Webhooks are primary but not instant and not guaranteed —
   * without this, the common case is a buyer staring at a spinner after a
   * successful payment, and the uncommon case is a dropped delivery leaving
   * them with no ticket at all.
   */
  @Post('orders/:orderId/sync')
  @UseGuards(AuthGuard)
  async sync(@Param('orderId') orderId: string, @Req() req: AuthedRequest) {
    await this.orders.getForUser(req.user.id, orderId); // 404s if not theirs
    return this.payments.reconcileOrder(orderId);
  }
}

/**
 * Payout setup. Scoped to the organisation and gated on the payout
 * permission, because an account link is a credential: whoever opens it can
 * finish onboarding as that organisation.
 */
@Controller('organizations/:orgId/connect')
@UseGuards(OrgMembershipGuard)
@OrgScope('param:orgId')
class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Get('status')
  @RequirePermissions(Permission.PAYOUT_VIEW)
  status(@Param('orgId') orgId: string) {
    return this.connect.status(orgId);
  }

  @Post('onboard')
  @RequirePermissions(Permission.PAYOUT_MANAGE)
  onboard(@Param('orgId') orgId: string, @Req() req: AuthedRequest) {
    // Stripe rejects anything that is not http(s) — a custom scheme like
    // `ekklesia://` comes back as "Not a valid URL" from accountLinks.create.
    // So onboarding returns to the web app, which is also the right place for
    // a host who started on a desktop browser.
    const web = process.env.WEB_URL ?? 'http://localhost:3000';
    const returnTo = `${web}/organizer/organizations/${orgId}/payouts`;
    return this.connect.startOnboarding(orgId, req.user.id, returnTo);
  }
}

@Controller('webhooks/stripe')
class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly payments: PaymentsService,
    private readonly connect: ConnectService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Stripe webhook.
   *
   * The URL is `/webhooks/stripe` — NOT `/v1/webhooks/stripe`. `bootstrap.ts`
   * excludes `webhooks/(.*)` from the global prefix, so pointing
   * `stripe listen --forward-to` at the /v1 path gets a 404 and every delivery
   * fails silently. Worth stating here because the controller decorator above
   * reads as though the prefix applies.
   *
   * Two different answers, on purpose:
   *
   *  - Signature fails → 400. This did not demonstrably come from Stripe. A
   *    200 here would be worse than useless: a wrong STRIPE_WEBHOOK_SECRET
   *    would show as green in Stripe's dashboard while nothing was processed,
   *    which is a silent failure nobody goes looking for.
   *  - Signature passes but handling throws → 200. A non-2xx makes Stripe
   *    retry for days, and a handler that throws on one malformed event would
   *    have it redelivered forever. The error is logged and `/sync` picks the
   *    order up regardless.
   */
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      // Means `rawBody: true` was lost from the Nest factory; signature
      // verification is impossible, so treat it as unverified.
      this.logger.error('Stripe webhook hit without rawBody');
      throw new BadRequestException('Raw body unavailable');
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch (err) {
      this.logger.error(`Stripe signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled':
          await this.payments.handleIntentEvent(event.data.object as Stripe.PaymentIntent);
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object as Stripe.Charge);
          break;
        case 'account.updated':
          // Onboarding finishes on Stripe's own pages, so this is how we
          // learn that a host can be paid.
          await this.connect.syncFromWebhook(event.data.object as Stripe.Account);
          break;
        default:
          // Everything else is acknowledged and ignored. Subscribing to fewer
          // event types in the dashboard is the right fix, not a louder log.
          this.logger.debug(`Unhandled Stripe event ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Handling ${event.type} (${event.id}) failed: ${(err as Error).message}`);
    }

    return { received: true };
  }

  /**
   * Mirror a refund issued in the Stripe dashboard.
   *
   * Refunds started from our own side will write these rows themselves; this
   * covers the case where someone refunds in Stripe directly, which otherwise
   * leaves a ticket valid for an event the holder has been paid back for.
   */
  private async handleRefund(charge: Stripe.Charge) {
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (!intentId) return;
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: intentId },
      select: { id: true, orderId: true, amountMinor: true },
    });
    if (!payment) return;

    const fullyRefunded = charge.amount_refunded >= charge.amount;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });

    if (fullyRefunded && payment.orderId) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'REFUNDED' },
      });
      await this.prisma.ticket.updateMany({
        where: { orderId: payment.orderId, status: { in: ['RESERVED', 'ISSUED'] } },
        data: { status: 'REFUNDED' },
      });
      this.logger.log(`Order ${payment.orderId} refunded in Stripe — tickets voided`);
    }
  }
}

@Module({
  controllers: [OrdersController, ConnectController, StripeWebhookController],
  providers: [StripeService, OrdersService, PaymentsService, ConnectService],
  exports: [StripeService, OrdersService, PaymentsService, ConnectService],
})
export class PaymentsModule {}

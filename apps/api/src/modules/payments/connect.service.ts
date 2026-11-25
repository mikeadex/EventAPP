import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PayoutStatus } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { StripeService } from './stripe.service.js';

/**
 * Stripe Connect — how an organiser gets paid.
 *
 * Until this existed, every ticket payment landed in the platform account
 * with no route onward: the money was taken correctly and then stuck. Orders
 * now use destination charges (`transfer_data.destination`), so the ticket
 * price goes to the organiser's own Stripe account and only the platform fee
 * stays behind, as `application_fee_amount`.
 *
 * The consequence is a rule the orders service enforces: an organisation that
 * cannot receive payouts cannot sell paid tickets. Free events are untouched.
 * Taking money we have no way to forward would be worse than refusing it.
 */
@Injectable()
export class ConnectService {
  private readonly logger = new Logger(ConnectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Start or resume onboarding.
   *
   * Idempotent on the account: Stripe keeps the half-finished one, so a host
   * who abandons the form and comes back resumes rather than starting a
   * second account. Account links, by contrast, are single-use and expire in
   * minutes, so a fresh one is minted each time.
   */
  async startOnboarding(orgId: string, actorUserId: string, returnTo: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        country: true,
        contactEmail: true,
        stripeAccountId: true,
        payoutStatus: true,
      },
    });
    if (!org) throw new NotFoundException('Organisation not found');

    const email = org.contactEmail;
    if (!email) {
      // Stripe can collect this itself, but asking here keeps the host in our
      // own form for a field we already ask for, rather than bouncing them
      // out to fill in something we could have had.
      throw new BadRequestException(
        'Add a contact email to your organisation before setting up payouts.',
      );
    }

    let accountId = org.stripeAccountId;
    if (!accountId) {
      const account = await this.stripe.createConnectedAccount({
        organizationId: org.id,
        email,
        country: org.country,
      });
      accountId = account.id;
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { stripeAccountId: accountId, payoutStatus: 'ONBOARDING' },
      });
      await this.audit.write({
        actorUserId,
        organizationId: org.id,
        action: 'connect.account_created',
        targetType: 'organization',
        targetId: org.id,
        metadata: { country: org.country } as Prisma.InputJsonValue,
      });
      this.logger.log(`Connect account created for ${org.name} (${accountId})`);
    }

    const link = await this.stripe.createAccountLink(accountId, returnTo, returnTo);
    return { url: link.url, expiresAt: new Date(link.expires_at * 1000).toISOString() };
  }

  /**
   * What Stripe currently thinks of this account.
   *
   * Read live rather than from our own column: onboarding finishes on
   * Stripe's pages, and the `account.updated` webhook may not have landed by
   * the time the host is looking at the screen again. The column is still
   * written, so anything that needs it without a round trip has it.
   */
  async status(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, stripeAccountId: true, payoutStatus: true, country: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');

    if (!org.stripeAccountId) {
      return {
        status: 'NOT_STARTED' as PayoutStatus,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsDue: [] as string[],
        country: org.country,
      };
    }

    const account = await this.stripe.client.accounts.retrieve(org.stripeAccountId);
    const derived = this.deriveStatus(account);
    if (derived !== org.payoutStatus) {
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { payoutStatus: derived },
      });
    }

    return {
      status: derived,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      // What Stripe is still waiting for. Shown so a stuck host can see why
      // rather than only that they are stuck.
      requirementsDue: [
        ...(account.requirements?.currently_due ?? []),
        ...(account.requirements?.past_due ?? []),
      ],
      country: account.country ?? org.country,
    };
  }

  /**
   * What has been, and will be, paid out — read from the connected account.
   *
   * Stripe is the ledger: payouts are scheduled and sent from the host's own
   * account, and nothing in our database knows about them. `pending` is what
   * Stripe is still settling, `available` what the next payout will carry.
   */
  async payouts(orgId: string, limit = 20) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeAccountId: true, payoutStatus: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');
    if (!org.stripeAccountId) {
      return { balance: null, schedule: null, items: [] };
    }
    const opts = { stripeAccount: org.stripeAccountId };
    const [balance, account, list] = await Promise.all([
      this.stripe.client.balance.retrieve(undefined, opts),
      this.stripe.client.accounts.retrieve(org.stripeAccountId),
      this.stripe.client.payouts.list({ limit: Math.min(100, Math.max(1, limit)) }, opts),
    ]);
    const sum = (rows: { amount: number; currency: string }[]) => {
      // One currency per account in practice; report the first, never add
      // across currencies.
      const first = rows[0];
      if (!first) return null;
      const amountMinor = rows
        .filter((r) => r.currency === first.currency)
        .reduce((n, r) => n + r.amount, 0);
      return { amountMinor, currency: first.currency.toUpperCase() };
    };
    const schedule = account.settings?.payouts?.schedule;
    return {
      balance: { available: sum(balance.available), pending: sum(balance.pending) },
      schedule: schedule
        ? {
            interval: schedule.interval,
            weeklyAnchor: schedule.weekly_anchor ?? null,
            monthlyAnchor: schedule.monthly_anchor ?? null,
            delayDays: schedule.delay_days,
          }
        : null,
      items: list.data.map((p) => ({
        id: p.id,
        amountMinor: p.amount,
        currency: p.currency.toUpperCase(),
        status: p.status,
        arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
        createdAt: new Date(p.created * 1000).toISOString(),
        method: p.method,
        failureMessage: p.failure_message ?? null,
      })),
    };
  }

  /**
   * Ticket sales over the last `days`, from our own payment records.
   *
   * The fee is charged on top of the ticket price, so "ticket sales" is what
   * the host earned and "booking fees" is what attendees paid Ekklesia —
   * shown so the figures add up to what Stripe took, never subtracted from
   * the host. Refunds come from our Refund rows; a payment marked REFUNDED
   * with none (refunded in the Stripe dashboard) counts in full.
   */
  async salesSummary(orgId: string, days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: orgId,
        orderId: { not: null },
        status: { in: ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
        createdAt: { gte: since },
      },
      select: {
        amountMinor: true,
        platformFeeMinor: true,
        currency: true,
        status: true,
        order: { select: { items: { select: { quantity: true } } } },
        refunds: { select: { amountMinor: true, status: true } },
      },
    });
    let salesMinor = 0;
    let feesMinor = 0;
    let refundsMinor = 0;
    let tickets = 0;
    for (const p of payments) {
      salesMinor += p.amountMinor - p.platformFeeMinor;
      feesMinor += p.platformFeeMinor;
      tickets += p.order?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
      const recorded = p.refunds
        .filter((r) => r.status !== 'failed' && r.status !== 'canceled')
        .reduce((n, r) => n + r.amountMinor, 0);
      refundsMinor +=
        recorded > 0 ? recorded : p.status === 'REFUNDED' ? p.amountMinor - p.platformFeeMinor : 0;
    }
    return {
      days,
      since: since.toISOString(),
      currency: payments[0]?.currency.toUpperCase() ?? 'GBP',
      orders: payments.length,
      tickets,
      salesMinor,
      feesMinor,
      refundsMinor,
      netMinor: salesMinor - refundsMinor,
    };
  }

  /**
   * Stripe's account flags collapsed into our enum.
   *
   * `payouts_enabled` is the one that matters for the rule above: an account
   * can take charges while payouts are still held, and money taken in that
   * window is money we would owe but could not send.
   */
  private deriveStatus(account: Stripe.Account): PayoutStatus {
    if (account.payouts_enabled && account.charges_enabled) return 'ENABLED';

    // `disabled_reason` is set on EVERY account that is not yet live,
    // including a brand-new one whose form has simply not been filled in.
    // Treating its presence as "restricted" labelled every host that way the
    // moment they started — alarming, and wrong. Only these mean a human at
    // Stripe has acted, or that the account cannot proceed on its own.
    const reason = account.requirements?.disabled_reason ?? '';
    const blocked =
      reason.startsWith('rejected') ||
      reason === 'platform_paused' ||
      reason === 'listed' ||
      reason === 'under_review' ||
      reason === 'other';
    if (blocked) return 'RESTRICTED';

    return 'ONBOARDING';
  }

  /** Mirror an `account.updated` webhook into our own column. */
  async syncFromWebhook(account: Stripe.Account) {
    const org = await this.prisma.organization.findFirst({
      where: { stripeAccountId: account.id },
      select: { id: true, name: true, payoutStatus: true },
    });
    if (!org) {
      this.logger.warn(`account.updated for ${account.id}, which matches no organisation`);
      return;
    }
    const derived = this.deriveStatus(account);
    if (derived === org.payoutStatus) return;
    await this.prisma.organization.update({
      where: { id: org.id },
      data: { payoutStatus: derived },
    });
    this.logger.log(`${org.name}: payouts ${org.payoutStatus} -> ${derived}`);
  }

  /**
   * The destination account for an order, or null when the organiser cannot
   * be paid. Callers treat null as "do not sell this".
   */
  async payableAccountFor(organizationId: string): Promise<string | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { stripeAccountId: true, payoutStatus: true },
    });
    if (!org?.stripeAccountId) return null;
    return org.payoutStatus === 'ENABLED' ? org.stripeAccountId : null;
  }
}

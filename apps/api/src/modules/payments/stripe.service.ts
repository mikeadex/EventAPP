import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  public readonly client: Stripe;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      this.logger.warn('STRIPE_SECRET_KEY not set — payment flows will fail until configured.');
    }
    this.client = new Stripe(key ?? 'sk_test_placeholder', { apiVersion: '2025-02-24.acacia' });
  }

  /**
   * Create or retrieve a Stripe Connect Express account for an organization.
   * Country must be ISO-3166-1 alpha-2. Capabilities reflect open-marketplace
   * needs: card payments + transfers (for payouts to the org).
   */
  async createConnectedAccount(params: {
    organizationId: string;
    email: string;
    country: string;
  }) {
    return this.client.accounts.create({
      type: 'express',
      country: params.country,
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { organizationId: params.organizationId },
    });
  }

  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    return this.client.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }
}

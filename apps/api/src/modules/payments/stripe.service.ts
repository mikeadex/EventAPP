import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Thin wrapper over the Stripe SDK.
 *
 * The client is only constructed when a real key is present. An earlier
 * version fell back to the literal `sk_test_placeholder`, which meant an
 * unconfigured deployment failed at the Stripe API with
 * "Invalid API Key provided: sk_test_***" — true, but it reads like a wrong
 * key rather than a missing one, and it only appears once someone is trying
 * to pay. `assertConfigured` turns that into a 503 that names the variable.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    // Boot-time env validation (see src/env.ts) treats unreplaced scaffolding
    // as unset; mirror that here so `sk_test_replace_me` is not taken for a key.
    const usable = key && !/replace|placeholder|changeme/i.test(key) ? key : null;
    if (!usable) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — paid tickets and donations will return 503. ' +
          'Free RSVP is unaffected.',
      );
      this.stripe = null;
    } else {
      this.stripe = new Stripe(usable, { apiVersion: '2025-02-24.acacia' });
    }
  }

  get isConfigured(): boolean {
    return this.stripe !== null;
  }

  /** The raw SDK. Throws rather than returning a client that cannot work. */
  get client(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Payments are not configured on this server (STRIPE_SECRET_KEY is not set).',
      );
    }
    return this.stripe;
  }

  /** Sent to the client so it can initialise the Stripe SDK. Safe to publish. */
  get publishableKey(): string | null {
    const k =
      process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      process.env.STRIPE_PUBLISHABLE_KEY ??
      null;
    if (!k || /replace|placeholder|changeme/i.test(k)) return null;
    // Belt and braces: env.ts fails the boot on this, but this value is handed
    // to clients, so never serve something that is not a publishable key.
    if (!k.startsWith('pk_')) {
      this.logger.error('Refusing to serve a non-publishable key to clients.');
      return null;
    }
    return k;
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
    if (!secret || /replace|placeholder/i.test(secret)) {
      throw new Error('STRIPE_WEBHOOK_SECRET not set');
    }
    return this.client.webhooks.constructEvent(rawBody, signature, secret);
  }
}

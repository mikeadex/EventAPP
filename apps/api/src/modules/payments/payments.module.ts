import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Module,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeService } from './stripe.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('webhooks/stripe')
class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Stripe webhook. Mounted outside /v1 (excluded in main.ts) so the raw body
   * is available for signature verification. The handler is intentionally
   * thin — real reconciliation happens in dedicated workers we'll add later.
   */
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      this.logger.error('Stripe webhook hit without rawBody');
      return { received: false };
    }
    let event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch (err) {
      this.logger.error(`Stripe signature verification failed: ${(err as Error).message}`);
      return { received: false };
    }

    this.logger.log(`Stripe event: ${event.type} (${event.id})`);

    // Phase 4: dispatch by event.type. For now, just acknowledge.
    return { received: true, type: event.type };
  }
}

@Module({
  controllers: [StripeWebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentsModule {}

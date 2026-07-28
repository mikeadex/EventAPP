import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../types.js';

export const PaymentStatus = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
  'disputed',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PayoutStatus = z.enum([
  'not_started',
  'onboarding',
  'restricted',
  'enabled',
  'disabled',
]);
export type PayoutStatus = z.infer<typeof PayoutStatus>;

export const CreateCheckoutSessionSchema = z.object({
  orderId: z.string().uuid(),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const CreateDonationSchema = z.object({
  organizationId: z.string().uuid(),
  amountMinor: z.number().int().min(100), // min 1.00
  currency: z.enum(SUPPORTED_CURRENCIES),
  message: z.string().max(280).optional(),
  anonymous: z.boolean().default(false),
});

export const RefundSchema = z.object({
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().min(1).optional(), // omit = full refund
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other']),
  note: z.string().max(500).optional(),
});

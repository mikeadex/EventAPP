import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../types.js';

/**
 * Ids in this schema are Prisma `cuid()`s, not UUIDs.
 *
 * These were scaffolded with `z.string().uuid()`, which rejects every id the
 * database actually issues (`cmf3k2...`). Nothing consumed them yet, so it had
 * never fired — but the first real checkout would have been a 400 with
 * "Invalid uuid" and no obvious cause. `ticket.ts` had it right.
 */
const id = z.string().min(1).max(64);

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

/**
 * Start a paid order.
 *
 * Quantities only — never prices. What a ticket costs is read from the
 * database at order time; a client-supplied amount is a client-chosen amount.
 *
 * Checkout requires an account, matching free RSVP. Guest checkout would need
 * its own ownership rules (the order id becomes the only credential) and its
 * own ticket-delivery path, so it is left out rather than half-built — the
 * `Order.guestEmail` column is there for when it is wanted.
 */
export const CreateOrderSchema = z.object({
  eventId: id,
  items: z
    .array(
      z.object({
        ticketTypeId: id,
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(20),
  attendeeName: z.string().min(1).max(120).optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const CreateDonationSchema = z.object({
  organizationId: id,
  amountMinor: z.number().int().min(100), // min 1.00
  currency: z.enum(SUPPORTED_CURRENCIES),
  message: z.string().max(280).optional(),
  anonymous: z.boolean().default(false),
});
export type CreateDonationInput = z.infer<typeof CreateDonationSchema>;

export const RefundSchema = z.object({
  paymentId: id,
  amountMinor: z.number().int().min(1).optional(), // omit = full refund
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other']),
  note: z.string().max(500).optional(),
});
export type RefundInput = z.infer<typeof RefundSchema>;

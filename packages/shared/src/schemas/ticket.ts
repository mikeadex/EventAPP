import { z } from 'zod';

export const TicketStatus = z.enum([
  'reserved',
  'issued',
  'checked_in',
  'cancelled',
  'refunded',
  'expired',
]);
export type TicketStatus = z.infer<typeof TicketStatus>;

export const ReserveTicketsSchema = z.object({
  eventId: z.string().min(1),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(20),
});
export type ReserveTicketsInput = z.infer<typeof ReserveTicketsSchema>;

/**
 * Free RSVP — single-quantity, no payment, no ticket type required (the event
 * may have one default "RSVP" ticket type or none). The server creates one
 * ticket per RSVP and increments attendeeCount transactionally.
 */
export const RsvpSchema = z.object({
  attendeeName: z.string().min(1).max(120).optional(),
  attendeeEmail: z.string().email().optional(),
  // For future "+1" style flows. Default 1.
  quantity: z.number().int().min(1).max(10).default(1),
});
export type RsvpInput = z.infer<typeof RsvpSchema>;

export const CheckInSchema = z.object({
  ticketCode: z.string().min(6).max(64),
  eventId: z.string().min(1),
});

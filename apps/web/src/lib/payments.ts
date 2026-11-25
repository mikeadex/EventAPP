import { apiClient } from './api-client';

/**
 * Checkout against the orders API, mirroring the mobile app's
 * `src/lib/payments.ts`.
 *
 * The server is the only authority on price: these calls send quantities and
 * read money back. The one number computed here, `previewFee`, is a preview
 * for the booking panel and is never what gets charged — `/v1/orders` quotes
 * the real total.
 */

export type OrderStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';

export interface OrderQuote {
  orderId: string;
  subtotalMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  expiresAt: string;
  items: { ticketTypeId: string; name: string; quantity: number; unitPriceMinor: number }[];
}

export interface OrderDetail {
  id: string;
  status: OrderStatus;
  subtotalMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  event: { id: string; title: string; startsAt: string };
  items: { quantity: number; unitPriceMinor: number; ticketType: { id: string; name: string } }[];
}

export interface PaymentIntentResponse {
  clientSecret: string;
  publishableKey: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export function createOrder(eventId: string, items: { ticketTypeId: string; quantity: number }[]) {
  return apiClient<OrderQuote>('/v1/orders', { method: 'POST', body: { eventId, items } });
}

export function getOrder(orderId: string) {
  return apiClient<OrderDetail>(`/v1/orders/${orderId}`);
}

export function createPaymentIntent(orderId: string) {
  return apiClient<PaymentIntentResponse>(`/v1/orders/${orderId}/payment-intent`, { method: 'POST' });
}

/**
 * Ask the server to check with Stripe now rather than wait for the webhook.
 * The webhook usually wins the race, but it is neither instant nor
 * guaranteed, and the buyer is looking at the screen.
 */
export function syncOrder(orderId: string) {
  return apiClient<{ status: string; ticketsIssued: number }>(`/v1/orders/${orderId}/sync`, { method: 'POST' });
}

/**
 * The platform fee, in basis points, added on top of the ticket price. One
 * fee, paid by the attendee; the host receives the ticket price. Matches the
 * API's default (`PLATFORM_FEE_BPS`, orders.service.ts) — the server's figure
 * is the one charged, this only previews it before an order exists.
 */
export const PLATFORM_FEE_BPS = 300;

/** Rounded half-up on the subtotal, as the server does, not per line. */
export function previewFee(subtotalMinor: number) {
  return Math.round((subtotalMinor * PLATFORM_FEE_BPS) / 10_000);
}

/** Seconds left before a reservation lapses, floored at zero. */
export function secondsUntil(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

/** 432 → "7:12", the hold countdown in the design. */
export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** What is still buyable of a type: stock, capped by the per-order maximum. */
export function availableOf(t: { quantity: number; sold: number; perOrderMax: number }) {
  return Math.max(0, Math.min(t.quantity - t.sold, t.perOrderMax));
}

export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

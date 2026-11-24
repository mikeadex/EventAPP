import { api } from './api';

/**
 * Checkout against the orders API.
 *
 * The server is the only authority on price: these calls send quantities and
 * read money back. Nothing here computes a total to charge — the one on screen
 * is whatever `/v1/orders` quoted.
 */

export interface TicketType {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  quantity: number;
  sold: number;
  perOrderMax: number;
  salesStart: string | null;
  salesEnd: string | null;
}

export interface OrderQuote {
  orderId: string;
  subtotalMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  expiresAt: string;
  items: { ticketTypeId: string; name: string; quantity: number; unitPriceMinor: number }[];
}

export interface PaymentIntentResponse {
  clientSecret: string;
  publishableKey: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface OrderDetail {
  id: string;
  status: 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED' | 'EXPIRED';
  subtotalMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  event: { id: string; title: string; startsAt: string };
  items: { quantity: number; unitPriceMinor: number; ticketType: { id: string; name: string } }[];
}

/**
 * The event as a buyer sees it, ticket types included.
 *
 * Deliberately NOT `/v1/events/:id/ticket-types`: that route is behind
 * `OrgMembershipGuard`, so a buyer asking what a ticket costs got
 * "Not a member of this organization". The public by-slug route already
 * carries the same ticket types and needs no permission at all.
 */
export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: { name?: string | null; city: string } | null;
  organization: { slug: string; name: string };
  ticketTypes: TicketType[];
}

export function getPublicEvent(orgSlug: string, eventSlug: string) {
  return api<PublicEvent>(`/v1/organizations/${orgSlug}/events/${eventSlug}`);
}

export function createOrder(eventId: string, items: { ticketTypeId: string; quantity: number }[]) {
  return api<OrderQuote>('/v1/orders', { method: 'POST', body: { eventId, items } });
}

export function getOrder(orderId: string) {
  return api<OrderDetail>(`/v1/orders/${orderId}`);
}

export function createPaymentIntent(orderId: string) {
  return api<PaymentIntentResponse>(`/v1/orders/${orderId}/payment-intent`, { method: 'POST' });
}

/**
 * Ask the server to check with Stripe now, rather than waiting for the webhook.
 *
 * The webhook is the primary path and usually wins the race, but it is neither
 * instant nor guaranteed — without this the common case is staring at a
 * spinner after a successful payment.
 */
export function syncOrder(orderId: string) {
  return api<{ status: string; ticketsIssued: number }>(`/v1/orders/${orderId}/sync`, {
    method: 'POST',
  });
}

/**
 * Minor units to a human amount: 9270 GBP → "£92.70".
 *
 * Zero-decimal currencies (JPY and friends) do not divide by 100. None are in
 * SUPPORTED_CURRENCIES today, but the list is one edit away from gaining one
 * and a silent hundred-fold error is not the way to find out.
 */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const zeroDecimal = ZERO_DECIMAL.has(code);
  const value = zeroDecimal ? minor : minor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    // An unknown code should still show a number rather than nothing.
    return `${code} ${value.toFixed(zeroDecimal ? 0 : 2)}`;
  }
}

/** Seconds left before a reservation lapses, floored at zero. */
export function secondsUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

/** 432 → "7:12", matching the hold countdown in the design. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** What is still buyable of a type, respecting both stock and the per-order cap. */
export function availableOf(t: TicketType): number {
  return Math.max(0, Math.min(t.quantity - t.sold, t.perOrderMax));
}

export function isOnSale(t: TicketType, now = Date.now()): boolean {
  if (t.salesStart && new Date(t.salesStart).getTime() > now) return false;
  if (t.salesEnd && new Date(t.salesEnd).getTime() <= now) return false;
  return true;
}

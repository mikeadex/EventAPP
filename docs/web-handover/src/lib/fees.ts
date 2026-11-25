/**
 * Money rules shown in the design. Keep the backend as the source of truth
 * for what is actually charged — these mirror it for live UI previews
 * (Create event › "Attendee pays / You receive", checkout totals).
 *
 * CONFIRM the two rates below against your payment setup before launch.
 */

/** Host platform fee — from the app's onboarding screen: 3% + £0.20 per paid ticket. */
export const PLATFORM_FEE_RATE = 0.03;
export const PLATFORM_FEE_FIXED = 0.2;

/** Attendee booking fee — design assumes 3% of ticket subtotal (app checkout: £2.70 on £90). */
export const BOOKING_FEE_RATE = 0.03;

/** Gift Aid adds 25% of the gift, claimed from HMRC by the charity. */
export const GIFT_AID_RATE = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function platformFee(price: number): number {
  return price > 0 ? round2(price * PLATFORM_FEE_RATE + PLATFORM_FEE_FIXED) : 0;
}

/** Create event › Tickets tier row. */
export function tierPreview(price: number, passFeesToAttendee: boolean) {
  const fee = platformFee(price);
  return passFeesToAttendee
    ? { attendeePays: round2(price + fee), hostReceives: price }
    : { attendeePays: price, hostReceives: round2(Math.max(0, price - fee)) };
}

export function bookingFee(subtotal: number): number {
  return round2(subtotal * BOOKING_FEE_RATE);
}

export function giftAid(amount: number, enabled: boolean): number {
  return enabled ? round2(amount * GIFT_AID_RATE) : 0;
}

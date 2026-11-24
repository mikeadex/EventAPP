/**
 * en-GB formatting. Dates are shown in the event's own timezone when it is
 * known (an event in New York reads in New York time wherever you are), and in
 * Europe/London otherwise.
 */
const DEFAULT_TZ = 'Europe/London';

function fmt(iso: string, opts: Intl.DateTimeFormatOptions, tz = DEFAULT_TZ) {
  try {
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: DEFAULT_TZ }).format(new Date(iso));
  }
}

export const fmtDay = (iso: string, tz?: string) =>
  fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }, tz);

export const fmtDayMonth = (iso: string, tz?: string) =>
  fmt(iso, { day: 'numeric', month: 'short' }, tz);

export const fmtDateLong = (iso: string, tz?: string) =>
  fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, tz);

export const fmtDateShort = (iso: string, tz?: string) =>
  fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' }, tz);

export const fmtYear = (iso: string, tz?: string) => fmt(iso, { year: 'numeric' }, tz);

export const fmtTime = (iso: string, tz?: string) =>
  fmt(iso, { hour: '2-digit', minute: '2-digit', hour12: false }, tz);

export const fmtWeekday = (iso: string, tz?: string) => fmt(iso, { weekday: 'long' }, tz);

/** "SAT 5 DEC AT 19:00" — the card eyebrow. */
export const fmtWhen = (iso: string, tz?: string) => `${fmtDay(iso, tz)} at ${fmtTime(iso, tz)}`;

export function money(minor: number, currency: string | null = 'GBP') {
  if (minor === 0) return 'Free';
  const major = minor / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'GBP',
    minimumFractionDigits: major % 1 ? 2 : 0,
  }).format(major);
}

/** Card price label from the search API's flattened price fields. */
export function cardPrice(e: { isFree: boolean; minPriceMinor: number; currency: string | null }) {
  if (e.isFree) return 'Free';
  return `From ${money(e.minPriceMinor, e.currency)}`;
}

/** Price label for a full list of tiers. */
export function tiersPrice(tiers: { priceMinor: number; currency: string }[]) {
  if (tiers.length === 0) return 'Free';
  const prices = tiers.map((t) => t.priceMinor);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const cur = tiers[0]!.currency;
  if (max === 0) return 'Free';
  if (min === 0) return `Free – ${money(max, cur)}`;
  return min === max ? money(min, cur) : `From ${money(min, cur)}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : parts[0]!.slice(0, 2);
  return letters.toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Google Maps search link for a venue (no API key needed). */
export function mapsUrl(v: { name?: string; addressLine1?: string; city?: string; postalCode?: string }) {
  const q = [v.name, v.addressLine1, v.city, v.postalCode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

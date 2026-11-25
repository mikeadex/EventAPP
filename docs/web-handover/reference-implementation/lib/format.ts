import type { EventItem } from "./data";

const tz = "Europe/London";

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(new Date(iso));

export const fmtDateLong = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(
    new Date(iso),
  );

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));

export const fmtMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: tz }).format(new Date(iso)).toUpperCase();

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(new Date(iso));

export const money = (n: number) =>
  n === 0
    ? "Free"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export const priceLabel = (e: EventItem) => {
  const prices = e.tiers.map((t) => t.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max === 0) return "Free";
  if (min === 0) return `Free – ${money(max)}`;
  return min === max ? money(min) : `From ${money(min)}`;
};

export const spotsLeft = (e: EventItem) => e.tiers.reduce((s, t) => s + t.remaining, 0);

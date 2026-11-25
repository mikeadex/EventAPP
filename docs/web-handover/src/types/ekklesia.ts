/**
 * Ekklesia Events — data the web UI needs, per the approved design.
 *
 * These are UI-facing shapes. If your existing Next.js backend returns
 * different field names, write a small adapter (src/lib/adapters.ts)
 * rather than changing the components. Fields marked "derived" can be
 * computed on the server from other fields.
 *
 * Money: integer pence from the API is safest; the UI helpers in
 * src/lib/format.ts take pounds (number) — convert once in the adapter.
 * Dates: ISO strings in UTC; render in Europe/London.
 */

export type Theme = "dark" | "light";

export type Category =
  | "Worship" | "Conference" | "Class" | "Outreach"
  | "Fundraiser" | "Youth" | "Prayer" | "Concert";

export type HostType = "Church" | "Ministry" | "Community";
export type Country = "GB" | "IE" | "US"; // sets default currency GBP / EUR / USD

/* ---------------- Public ---------------- */

export interface Host {
  id: string;
  slug: string;              // ekklesiaevents.com/{slug}
  name: string;
  type: HostType;
  area: string;              // "Woolwich"
  city: string;              // "London"
  country: Country;
  bio: string;               // max 240 chars
  logoUrl?: string;          // falls back to initials avatar
  coverUrl?: string;
  initials: string;          // derived
  followers: number;
  since: string;             // year joined, "2024"
  upcomingCount: number;     // derived
  isFollowing?: boolean;     // for the signed-in viewer
}

export interface TicketTier {
  id: string;
  name: string;              // "Standard", "Table of 10"
  description?: string;
  price: number;             // pounds; 0 = free
  remaining: number;
  maxPerOrder?: number;      // UI caps at 10
  isTable?: boolean;         // routes the CTA to table selection
  seatsPerTable?: number;
}

export type PricingKind = "free" | "paid" | "donation";

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  category: Category;
  host: Pick<Host, "slug" | "name" | "type" | "initials" | "bio">;
  start: string;             // ISO
  end: string;               // ISO
  venue: string;
  address: string;
  city: string;
  summary: string;           // one line, used on cards / meta description
  description: string[];     // paragraphs
  imageUrl?: string;         // falls back to generated cover art
  going: number;
  capacity: number;
  pricing: PricingKind;
  tiers: TicketTier[];
  donationsEnabled: boolean; // optional gift at checkout
  suggestedGift?: number;    // donation events
  giftAidEligible?: boolean; // host has a charity number
  visibility: "public" | "unlisted";
  status: "draft" | "live" | "cancelled" | "past";
  isSaved?: boolean;         // signed-in viewer
  attendeesPreview?: { initials: string }[]; // up to 3, "D M A + 182 going"
}

export interface DiscoverQuery {
  q?: string;
  category?: Category;
  when?: "any" | "week" | "month" | "later";
  price?: "any" | "free" | "paid";
  sort?: "soonest" | "popular";
  city?: string;
}

/* ---------------- Account ---------------- */

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
  initials: string;          // derived
  hosts: { slug: string; name: string; role: "owner" | "admin" | "door" }[];
  notificationPrefs: {
    reminders: boolean;      // 24h before
    hostsIFollow: boolean;
    eventChanges: boolean;
    monthlyRoundup: boolean;
  };
  connectedAccounts: ("apple" | "google")[];
}

export type AuthStep = "start" | "password" | "code" | "done";

/* ---------------- Booking ---------------- */

export interface CartLine { tierId: string; quantity: number; }

export interface BookingDraft {
  eventId: string;
  lines: CartLine[];
  tableNumber?: number;      // table events
  guestNames?: string[];     // free RSVP: one per place
  remind24h?: boolean;
  gift?: number;             // optional donation at checkout
  promoCode?: string;
  holdExpiresAt?: string;    // ISO — "Tickets held for 9:41"
}

export interface PriceBreakdown {
  lines: { label: string; amount: number }[]; // "2 × Single seat", "Gift to …"
  bookingFee: number;
  discount?: number;
  total: number;
}

export interface Booking {
  id: string;
  reference: string;         // "EK-CEMUDPNWLFM"
  event: Pick<EventItem, "slug" | "title" | "start" | "end" | "venue" | "address" | "city" | "imageUrl" | "category"> & { hostName: string };
  tickets: Ticket[];
  paid: number;              // 0 for free
  status: "confirmed" | "cancelled" | "refunded";
  createdAt: string;
}

export interface Ticket {
  id: string;
  code: string;              // encoded in the QR, one scan per ticket
  tierName: string;
  holderName?: string;
  status: "valid" | "checked_in" | "void";
  checkedInAt?: string;
  activeFrom: string;        // ISO — "Ticket will be active from"
  showAsGoing: boolean;
}

export type PaymentOutcome = "paid" | "rsvp" | "declined";

export interface Donation {
  eventId: string;
  amount: number;
  monthly: boolean;
  giftAid: boolean;          // adds 25% from HMRC, UK taxpayers only
}

/* ---------------- Host dashboard ---------------- */

export interface HostOnboarding {
  type: HostType;
  name: string;
  slug: string;
  country: Country;
  logo?: File;
  cover?: File;
  about: string;             // ≤ 240
  city: string;
  payouts: "bank" | "free-only";
  bank?: { accountName: string; sortCode: string; accountNumber: string }; // sent to payment provider, never stored by Ekklesia
  charityNumber?: string;
}

export interface EventDraft {
  title: string;
  category: Category;
  date: string;              // yyyy-mm-dd
  startTime: string;         // HH:mm
  endTime: string;
  venue: string;
  description: string;
  cover?: File;
  repeatsWeekly: boolean;    // creates six dates
  pricing: PricingKind;
  tiers: { name: string; price: number; quantity: number }[];
  passFeesToAttendee: boolean;
  freePlaces?: number;
  maxPerBooking?: number;
  suggestedGift?: number;
  visibility: "public" | "unlisted";
}

export interface SalesSummary {
  range: "d30" | "d90" | "year";
  gross: number;
  deltaPct?: number;         // vs previous period
  tickets: number;
  avgOrder: number;
  checkInRate?: number;      // 0–1
  series: { label: string; gross: number }[]; // daily (30/90) or monthly (year)
  events: {
    id: string; title: string; start: string;
    status: EventItem["status"]; sold: number; capacity: number; sales: number;
  }[];
}

export interface Attendee {
  bookingId: string;
  name: string;
  initials: string;
  quantity: number;
  code: string;
  bookedAt: string;
  checkedInAt?: string;
}

export type ScanResult =
  | { kind: "valid"; attendee: Attendee; tierName: string }
  | { kind: "used"; attendee: Attendee; scannedAt: string; scannedBy?: string }
  | { kind: "wrong-event"; eventTitle: string; code: string }
  | { kind: "invalid"; code: string };

export interface PayoutSummary {
  next: { amount: number; date: string; bankLast4: string; bankName: string };
  period: { from: string; to: string; gross: number; platformFee: number; refunds: number; net: number };
  history: { date: string; status: "paid" | "pending" | "failed"; eventCount: number; amount: number }[];
}

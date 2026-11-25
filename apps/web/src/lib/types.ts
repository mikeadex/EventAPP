/**
 * The shapes the API actually returns, as the web reads them. Dates are ISO
 * strings over the wire; money is in minor units (pence/cents).
 */

export interface EventCardData {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string; // SERVICE | WORSHIP | … (uppercase from Prisma)
  status: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isOnline: boolean;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  organization: { id: string; slug: string; name: string; logoUrl: string | null; country: string };
  venue: { city: string; country: string } | null;
  isFree: boolean;
  minPriceMinor: number;
  currency: string | null;
}

export interface EventSearchResult {
  items: EventCardData[];
  nextCursor: string | null;
}

export interface TicketTypeData {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  quantity: number;
  sold: number;
  perOrderMax: number;
}

export interface Venue {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
}

export interface EventDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  status: string;
  visibility: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  organization: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    country: string;
    /** Older API builds leave it out; treat that as claimed. */
    claimStatus?: ClaimStatus;
  };
  venue: Venue | null;
  ticketTypes: TicketTypeData[];
}

/** Whether a church page was added by staff and not yet taken on by the church. */
export type ClaimStatus = 'CLAIMED' | 'UNCLAIMED' | 'DISPUTED';

export interface Organization {
  id: string;
  slug: string;
  name: string;
  kind: 'CHURCH' | 'MINISTRY' | 'COMMUNITY';
  shortDescription: string | null;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  country: string;
  verificationStatus: string;
  claimStatus?: ClaimStatus;
}

export interface Membership {
  organizationId: string;
  slug: string;
  name: string;
  role: string;
  verificationStatus: string;
}

export interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  platformRole: string;
  profile: { displayName: string; city: string | null; avatarUrl: string | null } | null;
  memberships: Membership[];
  permissionsByOrg: Record<string, string[]>;
  /** Feature flags resolved for this user (`paid_tickets`, …). Older API builds leave it out. */
  capabilities?: Record<string, boolean>;
}

/** `Organization.payoutStatus`: where a host is with Stripe Connect. */
export type PayoutStatus = 'NOT_STARTED' | 'ONBOARDING' | 'RESTRICTED' | 'ENABLED' | 'DISABLED';

/** GET /v1/organizations/:orgId/connect/status */
export interface ConnectStatus {
  status: PayoutStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  country: string;
}

export interface Ticket {
  id: string;
  code: string;
  status: string;
  showAsAttending: boolean;
  issuedAt: string | null;
  checkedInAt: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  /** Older API builds don't send it; treat as absent. */
  ticketType?: { name: string; priceMinor: number; currency: string } | null;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    isOnline: boolean;
    onlineUrl: string | null;
    coverImageUrl: string | null;
    organization: { slug: string; name: string; logoUrl: string | null };
    venue: Venue | null;
  };
}

export interface SavedEvent {
  createdAt: string;
  /** The same card shape as search results. */
  event: EventCardData;
}

export interface OrgEvent {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  visibility: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
}

export interface Attendee {
  id: string;
  code: string;
  status: string;
  issuedAt: string | null;
  checkedInAt: string | null;
  name: string;
  email: string | null;
  image?: string | null;
  ticketType: { name: string; priceMinor: number; currency: string } | null;
}

export interface AttendeeList {
  items: Attendee[];
  total: number;
  checkedIn: number;
}

/** GET /v1/claims/:token — the page behind the link in a claim email. */
export interface ClaimInfo {
  organization: { name: string; slug: string; kind: string };
  email: string;
  events: { title: string; startsAt: string }[];
  hasAccount: boolean;
}

/** GET /v1/takedown/:token */
export interface TakedownInfo {
  organization: { name: string };
}

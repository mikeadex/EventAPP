/**
 * Feature flag keys. Resolution order at request time:
 *   1. organization_feature_flags row (if any)
 *   2. platform feature_flags row default
 *   3. compile-time default below
 *
 * Mobile/web read these via /v1/me as a capability manifest.
 */
export const FeatureFlag = {
  PAID_TICKETS: 'paid_tickets',
  DONATIONS: 'donations',
  REVIEWS: 'reviews',
  RECURRING_EVENTS: 'recurring_events',
  WAITLISTS: 'waitlists',
  REFERRAL_LINKS: 'referral_links',
  ORGANIZER_ANALYTICS: 'organizer_analytics',
  ADVANCED_CHECK_IN: 'advanced_check_in',
  GROUPS: 'groups',
  LIVESTREAM: 'livestream',
} as const;
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  paid_tickets: false,
  donations: false,
  reviews: false,
  recurring_events: true,
  waitlists: true,
  referral_links: false,
  organizer_analytics: true,
  advanced_check_in: false,
  groups: false,
  livestream: false,
};

export type CapabilityManifest = Record<FeatureFlag, boolean>;

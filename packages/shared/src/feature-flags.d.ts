/**
 * Feature flag keys. Resolution order at request time:
 *   1. organization_feature_flags row (if any)
 *   2. platform feature_flags row default
 *   3. compile-time default below
 *
 * Mobile/web read these via /v1/me as a capability manifest.
 */
export declare const FeatureFlag: {
    readonly PAID_TICKETS: "paid_tickets";
    readonly DONATIONS: "donations";
    readonly REVIEWS: "reviews";
    readonly RECURRING_EVENTS: "recurring_events";
    readonly WAITLISTS: "waitlists";
    readonly REFERRAL_LINKS: "referral_links";
    readonly ORGANIZER_ANALYTICS: "organizer_analytics";
    readonly ADVANCED_CHECK_IN: "advanced_check_in";
    readonly GROUPS: "groups";
    readonly LIVESTREAM: "livestream";
};
export type FeatureFlag = (typeof FeatureFlag)[keyof typeof FeatureFlag];
export declare const FEATURE_FLAG_DEFAULTS: Record<FeatureFlag, boolean>;
export type CapabilityManifest = Record<FeatureFlag, boolean>;
//# sourceMappingURL=feature-flags.d.ts.map
import { OrgRole } from './roles.js';
/**
 * Canonical permission keys. The server is the source of truth — clients
 * must never compute these locally, only render based on the set returned
 * by /v1/me.
 */
export declare const Permission: {
    readonly ORG_READ: "org:read";
    readonly ORG_UPDATE: "org:update";
    readonly ORG_DELETE: "org:delete";
    readonly ORG_MANAGE_STAFF: "org:manage_staff";
    readonly ORG_MANAGE_PAYOUTS: "org:manage_payouts";
    readonly ORG_MANAGE_BRANDING: "org:manage_branding";
    readonly EVENT_READ: "event:read";
    readonly EVENT_CREATE: "event:create";
    readonly EVENT_UPDATE: "event:update";
    readonly EVENT_DELETE: "event:delete";
    readonly EVENT_PUBLISH: "event:publish";
    readonly EVENT_CANCEL: "event:cancel";
    readonly TICKET_ISSUE: "ticket:issue";
    readonly TICKET_REFUND: "ticket:refund";
    readonly TICKET_CHECK_IN: "ticket:check_in";
    readonly TICKET_VIEW_ATTENDEES: "ticket:view_attendees";
    readonly PAYMENT_VIEW: "payment:view";
    readonly PAYMENT_REFUND: "payment:refund";
    readonly PAYOUT_VIEW: "payout:view";
    readonly PAYOUT_MANAGE: "payout:manage";
    readonly MODERATION_REVIEW: "moderation:review";
    readonly MODERATION_ACT: "moderation:act";
    readonly ADMIN_ORGS: "admin:orgs";
    readonly ADMIN_USERS: "admin:users";
    readonly ADMIN_FEATURE_FLAGS: "admin:feature_flags";
    readonly ADMIN_AUDIT: "admin:audit";
};
export type Permission = (typeof Permission)[keyof typeof Permission];
/**
 * Default permission map by org role. The API resolves this at request
 * time and may override per-organization.
 */
export declare const DEFAULT_ORG_PERMISSIONS: Record<OrgRole, Permission[]>;
//# sourceMappingURL=permissions.d.ts.map
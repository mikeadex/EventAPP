"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ORG_PERMISSIONS = exports.Permission = void 0;
/**
 * Canonical permission keys. The server is the source of truth — clients
 * must never compute these locally, only render based on the set returned
 * by /v1/me.
 */
exports.Permission = {
    // Organization
    ORG_READ: 'org:read',
    ORG_UPDATE: 'org:update',
    ORG_DELETE: 'org:delete',
    ORG_MANAGE_STAFF: 'org:manage_staff',
    ORG_MANAGE_PAYOUTS: 'org:manage_payouts',
    ORG_MANAGE_BRANDING: 'org:manage_branding',
    // Events
    EVENT_READ: 'event:read',
    EVENT_CREATE: 'event:create',
    EVENT_UPDATE: 'event:update',
    EVENT_DELETE: 'event:delete',
    EVENT_PUBLISH: 'event:publish',
    EVENT_CANCEL: 'event:cancel',
    // Tickets
    TICKET_ISSUE: 'ticket:issue',
    TICKET_REFUND: 'ticket:refund',
    TICKET_CHECK_IN: 'ticket:check_in',
    TICKET_VIEW_ATTENDEES: 'ticket:view_attendees',
    // Payments
    PAYMENT_VIEW: 'payment:view',
    PAYMENT_REFUND: 'payment:refund',
    PAYOUT_VIEW: 'payout:view',
    PAYOUT_MANAGE: 'payout:manage',
    // Moderation
    MODERATION_REVIEW: 'moderation:review',
    MODERATION_ACT: 'moderation:act',
    // Platform admin
    ADMIN_ORGS: 'admin:orgs',
    ADMIN_USERS: 'admin:users',
    ADMIN_FEATURE_FLAGS: 'admin:feature_flags',
    ADMIN_AUDIT: 'admin:audit',
};
/**
 * Default permission map by org role. The API resolves this at request
 * time and may override per-organization.
 */
exports.DEFAULT_ORG_PERMISSIONS = {
    member: [exports.Permission.ORG_READ, exports.Permission.EVENT_READ],
    volunteer: [
        exports.Permission.ORG_READ,
        exports.Permission.EVENT_READ,
        exports.Permission.TICKET_CHECK_IN,
    ],
    organizer: [
        exports.Permission.ORG_READ,
        exports.Permission.EVENT_READ,
        exports.Permission.EVENT_CREATE,
        exports.Permission.EVENT_UPDATE,
        exports.Permission.EVENT_PUBLISH,
        exports.Permission.EVENT_CANCEL,
        exports.Permission.TICKET_ISSUE,
        exports.Permission.TICKET_CHECK_IN,
        exports.Permission.TICKET_VIEW_ATTENDEES,
    ],
    moderator: [
        exports.Permission.ORG_READ,
        exports.Permission.EVENT_READ,
        exports.Permission.MODERATION_REVIEW,
        exports.Permission.MODERATION_ACT,
    ],
    finance_manager: [
        exports.Permission.ORG_READ,
        exports.Permission.PAYMENT_VIEW,
        exports.Permission.PAYMENT_REFUND,
        exports.Permission.PAYOUT_VIEW,
        exports.Permission.PAYOUT_MANAGE,
        exports.Permission.TICKET_REFUND,
    ],
    church_admin: [
        exports.Permission.ORG_READ,
        exports.Permission.ORG_UPDATE,
        exports.Permission.ORG_MANAGE_STAFF,
        exports.Permission.ORG_MANAGE_BRANDING,
        exports.Permission.EVENT_READ,
        exports.Permission.EVENT_CREATE,
        exports.Permission.EVENT_UPDATE,
        exports.Permission.EVENT_PUBLISH,
        exports.Permission.EVENT_CANCEL,
        exports.Permission.TICKET_ISSUE,
        exports.Permission.TICKET_CHECK_IN,
        exports.Permission.TICKET_VIEW_ATTENDEES,
        exports.Permission.TICKET_REFUND,
        exports.Permission.PAYMENT_VIEW,
    ],
    owner: Object.values(exports.Permission).filter((p) => !p.startsWith('admin:')),
};
//# sourceMappingURL=permissions.js.map
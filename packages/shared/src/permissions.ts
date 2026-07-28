import { OrgRole } from './roles.js';

/**
 * Canonical permission keys. The server is the source of truth — clients
 * must never compute these locally, only render based on the set returned
 * by /v1/me.
 */
export const Permission = {
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
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Default permission map by org role. The API resolves this at request
 * time and may override per-organization.
 */
export const DEFAULT_ORG_PERMISSIONS: Record<OrgRole, Permission[]> = {
  member: [Permission.ORG_READ, Permission.EVENT_READ],
  volunteer: [
    Permission.ORG_READ,
    Permission.EVENT_READ,
    Permission.TICKET_CHECK_IN,
  ],
  organizer: [
    Permission.ORG_READ,
    Permission.EVENT_READ,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,
    Permission.EVENT_PUBLISH,
    Permission.EVENT_CANCEL,
    Permission.TICKET_ISSUE,
    Permission.TICKET_CHECK_IN,
    Permission.TICKET_VIEW_ATTENDEES,
  ],
  moderator: [
    Permission.ORG_READ,
    Permission.EVENT_READ,
    Permission.MODERATION_REVIEW,
    Permission.MODERATION_ACT,
  ],
  finance_manager: [
    Permission.ORG_READ,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_REFUND,
    Permission.PAYOUT_VIEW,
    Permission.PAYOUT_MANAGE,
    Permission.TICKET_REFUND,
  ],
  church_admin: [
    Permission.ORG_READ,
    Permission.ORG_UPDATE,
    Permission.ORG_MANAGE_STAFF,
    Permission.ORG_MANAGE_BRANDING,
    Permission.EVENT_READ,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,
    Permission.EVENT_PUBLISH,
    Permission.EVENT_CANCEL,
    Permission.TICKET_ISSUE,
    Permission.TICKET_CHECK_IN,
    Permission.TICKET_VIEW_ATTENDEES,
    Permission.TICKET_REFUND,
    Permission.PAYMENT_VIEW,
  ],
  owner: Object.values(Permission).filter(
    (p) => !p.startsWith('admin:'),
  ) as Permission[],
};

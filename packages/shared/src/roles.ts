/**
 * Platform-level roles. A user has at most one platform role.
 */
export const PlatformRole = {
  USER: 'user',
  PLATFORM_ADMIN: 'platform_admin',
  PLATFORM_MODERATOR: 'platform_moderator',
  PLATFORM_SUPPORT: 'platform_support',
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

/**
 * Organization-scoped roles. A user can hold different roles in different organizations.
 */
export const OrgRole = {
  MEMBER: 'member',
  VOLUNTEER: 'volunteer',
  ORGANIZER: 'organizer',
  FINANCE_MANAGER: 'finance_manager',
  MODERATOR: 'moderator',
  CHURCH_ADMIN: 'church_admin',
  OWNER: 'owner',
} as const;
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  member: 0,
  volunteer: 10,
  organizer: 20,
  moderator: 30,
  finance_manager: 30,
  church_admin: 40,
  owner: 50,
};

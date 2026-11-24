import type { Me } from './types';

/** Roles that can run an organisation's events (matches the API's permissions). */
export const HOST_ROLES = ['OWNER', 'CHURCH_ADMIN', 'ORGANIZER'];

export function hostMemberships(me: Me) {
  return me.memberships.filter((m) => HOST_ROLES.includes(m.role));
}

export const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  CHURCH_ADMIN: 'Admin',
  ORGANIZER: 'Organiser',
  VOLUNTEER: 'Volunteer',
  MODERATOR: 'Moderator',
  FINANCE_MANAGER: 'Finance',
  MEMBER: 'Member',
};

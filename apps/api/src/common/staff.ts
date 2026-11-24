export const STAFF_DOMAIN = 'ekklesiaevents.com';

export type StaffBlockReason = 'NOT_STAFF' | 'WRONG_DOMAIN' | 'NEEDS_2FA';

/** True only for an address exactly on the staff domain (no subdomains, no lookalikes). */
export function isStaffEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${STAFF_DOMAIN}`);
}

/**
 * Why this account may not act as staff, or null if it may. Staff = a platform
 * role, an address on the staff domain, and 2-step enabled. No allow-list.
 */
export function staffBlockReason(u: {
  email: string;
  platformRole: string;
  twoFactorEnabled: boolean;
}): StaffBlockReason | null {
  if (u.platformRole === 'USER') return 'NOT_STAFF';
  if (!isStaffEmail(u.email)) return 'WRONG_DOMAIN';
  if (!u.twoFactorEnabled) return 'NEEDS_2FA';
  return null;
}

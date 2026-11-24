'use client';

import { apiClient, ApiError } from './api-client';

/** `apiClient` for the admin console: paths are relative to `/v1/admin`. */
export function adminApi<T = unknown>(path: string, init?: Parameters<typeof apiClient>[1]): Promise<T> {
  return apiClient<T>(`/v1/admin${path.startsWith('/') ? path : `/${path}`}`, init);
}

export type PlatformRole = 'PLATFORM_SUPPORT' | 'PLATFORM_MODERATOR' | 'PLATFORM_ADMIN' | 'PLATFORM_FINANCE';

/** The signed-in staff member, from `GET /v1/admin/me`. */
export interface AdminMe {
  id: string;
  name: string | null;
  email: string;
  platformRole: PlatformRole;
}

/**
 * Roles allowed to change things (add, resend, change contact, restore,
 * unpublish). Support can read only. The server enforces this anyway; the
 * console just hides controls that would be refused.
 */
export function canModerate(role: PlatformRole) {
  return role === 'PLATFORM_MODERATOR' || role === 'PLATFORM_ADMIN';
}

/** The `{ code }` of an admin API error body, if it has one. */
export function errorCode(e: unknown): string | undefined {
  if (!(e instanceof ApiError)) return undefined;
  const p = e.payload;
  if (p && typeof p === 'object' && 'code' in p && typeof (p as { code: unknown }).code === 'string') {
    return (p as { code: string }).code;
  }
  return undefined;
}

export const ROLE_LABELS: Record<PlatformRole, string> = {
  PLATFORM_ADMIN: 'Super admin',
  PLATFORM_MODERATOR: 'Moderator',
  PLATFORM_SUPPORT: 'Support',
  PLATFORM_FINANCE: 'Finance',
};

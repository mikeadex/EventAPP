'use client';

import { apiClient } from './api-client';

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

export const ROLE_LABELS: Record<PlatformRole, string> = {
  PLATFORM_ADMIN: 'Super admin',
  PLATFORM_MODERATOR: 'Moderator',
  PLATFORM_SUPPORT: 'Support',
  PLATFORM_FINANCE: 'Finance',
};

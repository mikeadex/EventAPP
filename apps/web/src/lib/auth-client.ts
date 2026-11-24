'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth client for the web. The API mounts the Better Auth router at
 * `/auth/*` on `NEXT_PUBLIC_API_URL`. We rely on cross-origin credentials so
 * the API's session cookie is sent on every request.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  basePath: '/auth',
  fetchOptions: { credentials: 'include' },
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  updateUser,
} = authClient;

/** Absolute URL on this site — Better Auth resolves relative ones against the API. */
export function webUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

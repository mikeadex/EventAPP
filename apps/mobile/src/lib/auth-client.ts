import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

/**
 * Mobile auth client — bearer-token persistence without the @better-auth/expo
 * plugin (which pulls native deps we don't need).
 *
 * Flow:
 *   - The API's `bearer()` plugin returns the session token in a
 *     `set-auth-token` response header on sign-in/sign-up.
 *   - We capture it in `onSuccess` and persist it in the device keychain
 *     (SecureStore), so it survives app restarts.
 *   - Every subsequent request sends `Authorization: Bearer <token>`, which
 *     the API validates as a session.
 */
const TOKEN_KEY = 'ekklesia_session_token';

// In-memory cache so synchronous getters don't hit the keychain every call.
let cachedToken: string | null | undefined;

export function getStoredToken(): string | null {
  if (cachedToken === undefined) {
    cachedToken = SecureStore.getItem(TOKEN_KEY);
  }
  return cachedToken ?? null;
}

function setStoredToken(token: string | null): void {
  cachedToken = token;
  if (token) {
    void SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    void SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/**
 * Drop the persisted session token. Called when the server rejects our token
 * with a 401 (expired/revoked session) so we don't keep replaying a dead token.
 */
export function clearStoredToken(): void {
  setStoredToken(null);
}

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  basePath: '/auth',
  fetchOptions: {
    // Native client is Bearer-only — never attach cookies. React Native's
    // cookie jar would otherwise replay a stale Better Auth session cookie on
    // auth calls, and since native fetch sends no Origin header, the server's
    // CSRF/origin check (which only runs when a cookie is present) rejects the
    // request with "Missing or null Origin". Omitting credentials keeps every
    // auth call cookie-free and consistent with our SecureStore bearer flow.
    credentials: 'omit',
    auth: {
      type: 'Bearer',
      token: () => getStoredToken() ?? '',
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get('set-auth-token');
      if (token) setStoredToken(token);
    },
  },
});

export const {
  useSession,
  signIn,
  signUp,
  requestPasswordReset,
  resetPassword,
  updateUser,
  changePassword,
} = authClient;

/** Sign out: clear the server session AND the locally stored token. */
export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    setStoredToken(null);
  }
}

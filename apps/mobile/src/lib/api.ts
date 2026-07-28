import { router } from 'expo-router';
import { clearStoredToken, getStoredToken } from './auth-client';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

// Guard so a burst of concurrent 401s (e.g. several screens loading at once)
// only triggers a single sign-out redirect rather than stacking navigations.
let handlingExpiry = false;

/**
 * An authenticated request came back 401 → the session token is dead. Clear it
 * and bounce the user to sign-in. Public endpoints never send a token, so this
 * only fires for genuinely expired/revoked sessions.
 */
function handleSessionExpired(): void {
  clearStoredToken();
  if (handlingExpiry) return;
  handlingExpiry = true;
  try {
    router.replace('/auth/sign-in');
  } finally {
    // Re-arm shortly after so a later expiry can redirect again.
    setTimeout(() => {
      handlingExpiry = false;
    }, 1000);
  }
}

/**
 * Mobile API client. Attaches the persisted session token (SecureStore) as a
 * Bearer header so authenticated /v1 endpoints recognise the caller across
 * app restarts.
 */
export async function api<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // If we attached a token but the server rejected it, the session is dead —
  // clear it and redirect to sign-in before surfacing the error.
  if (res.status === 401 && token) {
    handleSessionExpired();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const payload = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })()
    : null;
  if (!res.ok) {
    const msg =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed: ${res.status}`;
    throw new ApiError(res.status, payload, msg);
  }
  return payload as T;
}

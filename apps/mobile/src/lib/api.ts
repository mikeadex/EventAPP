import { router } from 'expo-router';
import { clearStoredToken, getStoredToken } from './auth-client';
import { fetchWithRetry } from './fetch-retry';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

/**
 * A message worth showing a user.
 *
 * The API answers invalid input with a list of field issues under a generic
 * "Request failed validation", which on its own tells nobody which field is
 * wrong. Surface the first specific issue instead, labelled with its field.
 */
export function describeApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) {
    const payload = err.payload as
      | { issues?: { path?: string; message?: string }[]; message?: string }
      | null;
    const issue = payload?.issues?.find((i) => i.message);
    if (issue?.message) {
      const field = issue.path?.split('.').pop();
      return field ? `${humanise(field)}: ${issue.message}` : issue.message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

/** "addressLine1" → "Address line 1", so the label reads like the form. */
function humanise(field: string): string {
  const spaced = field
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  const res = await fetchWithRetry(`${BASE}${path}`, {
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

import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from './api';
import { authClient } from './auth-client';

/**
 * Social sign-in for the native app.
 *
 * The flow crosses two worlds. Better Auth runs OAuth in a web view and ends
 * with a session **cookie**, but this app authenticates with a bearer token
 * from SecureStore and sends no cookies at all. So the server's
 * /v1/native-auth/handoff mints a single-use token from that cookie session and
 * bounces back into the app on the deep link; we exchange it here for a real
 * session.
 *
 * Going through `authClient` for the exchange is what persists the login: its
 * `onSuccess` reads the `set-auth-token` header and writes it to SecureStore,
 * exactly as email sign-in does.
 */
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const SCHEME = 'ekklesia';
const RETURN_URL = `${SCHEME}://auth/social`;

/**
 * Whether this binary can actually open an OAuth session.
 *
 * This file's JS reaches existing installs over the air, and those binaries
 * were built before expo-web-browser was added. `requireOptionalNativeModule`
 * answers with null instead of throwing, so the buttons can simply be withheld
 * rather than failing when tapped.
 */
export function canUseSocialSignIn(): boolean {
  return requireOptionalNativeModule('ExpoWebBrowser') != null;
}

export type SocialResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'unsupported' | 'failed'; message?: string };

export async function signInWithProvider(provider: string): Promise<SocialResult> {
  if (!canUseSocialSignIn()) return { ok: false, reason: 'unsupported' };

  let authUrl: string;
  try {
    // The server answers with the provider's consent URL rather than redirecting,
    // because there is no browser here to follow a 302.
    const res = await api<{ url?: string; redirect?: boolean }>('/auth/sign-in/social', {
      method: 'POST',
      body: { provider, callbackURL: `${BASE}/v1/native-auth/handoff` },
    });
    if (!res.url) return { ok: false, reason: 'failed', message: 'No sign-in URL returned' };
    authUrl = res.url;
  } catch (e) {
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : undefined };
  }

  let result: { type: string; url?: string };
  try {
    // Required lazily so the module is only touched on a build that has it.
    const WebBrowser = require('expo-web-browser') as {
      openAuthSessionAsync(
        url: string,
        returnUrl: string,
      ): Promise<{ type: string; url?: string }>;
    };
    result = await WebBrowser.openAuthSessionAsync(authUrl, RETURN_URL);
  } catch {
    // The JS is present but the native module is not — an older binary that
    // predates this feature. Say so plainly rather than failing mysteriously.
    return { ok: false, reason: 'unsupported' };
  }

  if (result.type !== 'success' || !result.url) {
    return { ok: false, reason: 'cancelled' };
  }

  const params = new URL(result.url).searchParams;
  const error = params.get('error');
  if (error) return { ok: false, reason: 'failed', message: error };

  const token = params.get('token');
  if (!token) return { ok: false, reason: 'failed', message: 'No token in the callback' };

  try {
    // Through authClient so its onSuccess captures set-auth-token into SecureStore.
    const res = await authClient.$fetch('/one-time-token/verify', {
      method: 'POST',
      body: { token },
    });
    if ((res as { error?: unknown })?.error) {
      return { ok: false, reason: 'failed', message: 'Could not complete sign-in' };
    }
  } catch (e) {
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : undefined };
  }

  return { ok: true };
}

/** Providers this deployment can actually complete, so buttons match reality. */
export async function fetchSocialProviders(): Promise<string[]> {
  // No point offering providers this binary cannot complete.
  if (!canUseSocialSignIn()) return [];
  try {
    const c = await api<{ socialProviders?: string[] }>('/v1/config');
    return c.socialProviders ?? [];
  } catch {
    return [];
  }
}

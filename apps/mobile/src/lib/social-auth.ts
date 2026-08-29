import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from './api';
import { authClient } from './auth-client';

/**
 * Social sign-in for the native app. Two routes, for one awkward reason.
 *
 * Better Auth's OAuth flow runs in a web view and ends with a session
 * **cookie**, but this app authenticates with a bearer token from SecureStore
 * and sends no cookies at all. Bridging that is what /v1/native-auth/handoff is
 * for: it mints a single-use token from the cookie session and bounces back
 * into the app on the deep link, and we trade it for a real session here. That
 * is the route Google and Android Apple take.
 *
 * Apple on iOS skips all of it. Its native sheet returns a signed identity
 * token directly, the server verifies it against Apple's public keys, and a
 * session comes straight back — no web view, no cookie, nothing to hand over.
 * Better UX and materially less machinery, so it is preferred wherever the
 * binary has the module.
 *
 * Either way the exchange goes through `authClient`, and that is what persists
 * the login: its `onSuccess` reads the `set-auth-token` header into SecureStore,
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

/**
 * Whether Apple's own sign-in sheet is available.
 *
 * iOS only, and gated the same way: existing binaries predate
 * expo-apple-authentication, so this has to answer false rather than throw on
 * import. Preferred over the web view when present — it is Face ID in a native
 * sheet instead of a browser, and it is what App Review expects to see on iOS.
 */
export function canUseNativeApple(): boolean {
  return Platform.OS === 'ios' && requireOptionalNativeModule('ExpoAppleAuthentication') != null;
}

type AppleAuthModule = {
  AppleAuthenticationScope: { FULL_NAME: number; EMAIL: number };
  signInAsync(options: { requestedScopes: number[] }): Promise<{
    identityToken: string | null;
    email?: string | null;
    fullName?: { givenName?: string | null; familyName?: string | null } | null;
  }>;
};

/**
 * Tell the client's session store to refetch.
 *
 * `onSuccess` in auth-client.ts persists the bearer token, but that is a fetch
 * hook and says nothing to the reactive session atom. Better Auth refetches
 * that atom only for a fixed list of paths — /sign-in/email, /sign-up/email,
 * /sign-out and a few others — and neither /sign-in/social nor
 * /one-time-token/verify is on it. So a social sign-in genuinely succeeded, the
 * token was stored, and `useSession()` still returned null: signed in, yet every
 * gated screen still asking you to sign in.
 *
 * Nudging the signal directly is what the client's own sign-in actions do.
 */
function refreshSession(): void {
  try {
    (authClient as unknown as { $store: { notify: (signal: string) => void } }).$store.notify(
      '$sessionSignal',
    );
  } catch {
    // Never fail a completed sign-in over a refresh nudge; the session is real
    // either way and the next app launch reads it from SecureStore.
  }
}

/**
 * Sign in through Apple's native sheet.
 *
 * Simpler than the web-view flow it replaces: Apple hands back a signed identity
 * token, the server verifies it against Apple's public keys, and a session comes
 * straight back. No OAuth state cookie, no web view, and no one-time token
 * handoff — all of which exist only because a browser session cannot be handed
 * to a bearer-token client directly.
 *
 * The token's audience is the app's bundle id rather than the Services ID, which
 * is why the server is given APPLE_BUNDLE_ID.
 */
async function signInWithNativeApple(): Promise<SocialResult> {
  let credential: Awaited<ReturnType<AppleAuthModule['signInAsync']>>;
  try {
    // Required lazily so the module is only touched on a build that has it.
    const Apple = require('expo-apple-authentication') as AppleAuthModule;
    credential = await Apple.signInAsync({
      requestedScopes: [
        Apple.AppleAuthenticationScope.FULL_NAME,
        Apple.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // Apple reports a dismissed sheet as an error rather than an empty result.
    const code = (e as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : undefined };
  }

  if (!credential.identityToken) {
    return { ok: false, reason: 'failed', message: 'Apple returned no identity token' };
  }

  try {
    // Through authClient so its onSuccess captures set-auth-token into SecureStore.
    // Name and email are sent because Apple only discloses them on the *first*
    // authorisation ever granted to this app — miss them and the account has no
    // name, with no second chance to ask.
    const res = await authClient.$fetch('/sign-in/social', {
      method: 'POST',
      body: {
        provider: 'apple',
        idToken: {
          token: credential.identityToken,
          user: {
            email: credential.email ?? undefined,
            name:
              credential.fullName?.givenName || credential.fullName?.familyName
                ? {
                    firstName: credential.fullName.givenName ?? undefined,
                    lastName: credential.fullName.familyName ?? undefined,
                  }
                : undefined,
          },
        },
      },
    });
    if ((res as { error?: unknown })?.error) {
      return { ok: false, reason: 'failed', message: 'Could not complete sign-in' };
    }
  } catch (e) {
    return { ok: false, reason: 'failed', message: e instanceof Error ? e.message : undefined };
  }

  refreshSession();
  return { ok: true };
}

export type SocialResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'unsupported' | 'failed'; message?: string };

export async function signInWithProvider(provider: string): Promise<SocialResult> {
  // Apple's own sheet where the binary supports it; the web view is the fallback
  // for Android and for builds without the native module.
  if (provider === 'apple' && canUseNativeApple()) return signInWithNativeApple();
  if (!canUseSocialSignIn()) return { ok: false, reason: 'unsupported' };

  // Point the web view at the server's start endpoint rather than asking for a
  // URL here. The OAuth state cookie has to be set inside that web view; when
  // the app made the request itself the cookie landed on this fetch — which
  // discards cookies by design — and every callback failed with state_mismatch.
  const handoff = `${BASE}/v1/native-auth/handoff`;
  const authUrl =
    `${BASE}/v1/social/start?provider=${encodeURIComponent(provider)}` +
    `&redirect=${encodeURIComponent(handoff)}`;

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

  refreshSession();
  return { ok: true };
}

/** Providers this deployment can actually complete, so buttons match reality. */
export async function fetchSocialProviders(): Promise<string[]> {
  const web = canUseSocialSignIn();
  const nativeApple = canUseNativeApple();
  // No point offering providers this binary cannot complete.
  if (!web && !nativeApple) return [];
  try {
    const c = await api<{ socialProviders?: string[] }>('/v1/config');
    // Apple survives on either path; everything else needs the web view. The two
    // are separate native modules, so a binary really can have one and not the
    // other, and offering a button that dead-ends is the thing worth avoiding.
    return (c.socialProviders ?? []).filter((id) => (id === 'apple' ? nativeApple || web : web));
  } catch {
    return [];
  }
}

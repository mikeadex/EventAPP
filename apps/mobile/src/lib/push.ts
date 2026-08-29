import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { api } from './api';

/**
 * Push registration for the native app.
 *
 * Three things this deliberately does not do.
 *
 * It does not ask for permission on launch. A permission prompt with no context
 * is the one most people decline, and iOS only ever asks once — a refusal is
 * effectively permanent, so the ask is left to a moment where the reason is
 * obvious (see `registerForPush`'s callers).
 *
 * It does not treat failure as an error worth surfacing. Someone who declines
 * notifications has made a choice, not hit a bug.
 *
 * And it is gated on the native module like every other native capability here,
 * because this JS reaches installs built before expo-notifications existed.
 */
export function canUsePush(): boolean {
  return requireOptionalNativeModule('ExpoPushTokenManager') != null;
}

type NotificationsModule = {
  getPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  getExpoPushTokenAsync(opts?: { projectId?: string }): Promise<{ data: string }>;
  setNotificationChannelAsync(name: string, opts: Record<string, unknown>): Promise<unknown>;
  AndroidImportance: { DEFAULT: number };
};

function load(): NotificationsModule | null {
  if (!canUsePush()) return null;
  try {
    // Required lazily so the module is only touched on a build that has it.
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** The EAS project id, which getExpoPushTokenAsync needs in a bare/dev build. */
function projectId(): string | undefined {
  try {
    const Constants = require('expo-constants').default as {
      expoConfig?: { extra?: { eas?: { projectId?: string } } };
      easConfig?: { projectId?: string };
    };
    return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  } catch {
    return undefined;
  }
}

export type PushRegistration =
  | { ok: true; token: string }
  | { ok: false; reason: 'unsupported' | 'denied' | 'failed' };

/**
 * Ask for permission if needed, then hand the token to the API.
 *
 * Safe to call repeatedly — the server upserts on the token, and re-registering
 * is how a token that was retired as dead comes back after a reinstall.
 */
export async function registerForPush(
  opts: { prompt?: boolean } = {},
): Promise<PushRegistration> {
  const Notifications = load();
  if (!Notifications) return { ok: false, reason: 'unsupported' };

  try {
    // Android needs a channel before anything will display, and creating it is
    // idempotent, so it happens before the permission dance rather than after.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      // Without `prompt`, this is a silent refresh — it keeps an already-granted
      // token current and otherwise gives up. Only a caller with a reason to
      // show the user asks, because iOS grants exactly one prompt per install.
      if (!opts.prompt) return { ok: false, reason: 'denied' };
      // canAskAgain is false once iOS has been told no. Asking again silently
      // resolves as denied, so skip it rather than pretend we tried.
      if (!existing.canAskAgain) return { ok: false, reason: 'denied' };
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });

    await api('/v1/devices', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Stop this device receiving for the signed-in account.
 *
 * Called on sign-out. Without it, a shared phone keeps delivering one person's
 * notifications after someone else has signed in — which is a privacy problem,
 * not just an annoyance.
 */
export async function unregisterFromPush(): Promise<void> {
  const Notifications = load();
  if (!Notifications) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });
    await api('/v1/devices', { method: 'DELETE', body: { token } });
  } catch {
    // Best effort: the token may already be gone, or the network unavailable
    // during sign-out. The server also reassigns a token on the next register.
  }
}

/**
 * Keep an already-granted token current, without ever prompting.
 *
 * Expo tokens can rotate, and a stale one silently stops receiving. Called on
 * launch when signed in; a no-op for anyone who has not granted permission.
 */
export async function syncPushRegistration(): Promise<void> {
  await registerForPush().catch(() => undefined);
}

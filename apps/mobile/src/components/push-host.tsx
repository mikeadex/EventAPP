import { useEffect } from 'react';
import { router } from 'expo-router';
import { useSession } from '@/lib/auth-client';
import { canUsePush, syncPushRegistration } from '@/lib/push';

/**
 * Keeps the push token current and routes a tapped notification.
 *
 * Mounted once at the root. Renders nothing — it exists because both jobs need
 * to run wherever the user happens to be, including on a cold start where the
 * notification tap is what opened the app.
 */
type NotificationsModule = {
  setNotificationHandler(handler: unknown): void;
  addNotificationResponseReceivedListener(
    cb: (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => void,
  ): { remove(): void };
  getLastNotificationResponseAsync(): Promise<{
    notification: { request: { content: { data?: Record<string, unknown> } } };
  } | null>;
};

/** Where a notification's `data` says to go. Unknown shapes are ignored. */
function routeTo(data: Record<string, unknown> | undefined) {
  if (!data) return;
  if (data.type === 'ticket' && typeof data.ticketId === 'string') {
    router.push(`/tickets/${data.ticketId}`);
  } else if (data.type === 'event' && typeof data.eventId === 'string') {
    router.push(`/event/${data.eventId}`);
  }
}

export function PushHost() {
  const { data: session } = useSession();
  const signedIn = !!session?.user;

  // Token refresh. Only once signed in — the register call is authenticated,
  // and a token with no account attached is not useful to anyone.
  useEffect(() => {
    if (!signedIn) return;
    void syncPushRegistration();
  }, [signedIn]);

  useEffect(() => {
    if (!canUsePush()) return;
    let sub: { remove(): void } | undefined;
    let cancelled = false;

    try {
      const Notifications = require('expo-notifications') as NotificationsModule;

      // Without a handler, a notification arriving while the app is open is
      // swallowed entirely — no banner, no sound, and no clue why.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        routeTo(response.notification.request.content.data);
      });

      // A tap on a cold start is delivered before any listener exists, so the
      // launch response has to be read separately or that tap does nothing.
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!cancelled && response) routeTo(response.notification.request.content.data);
      });
    } catch {
      // Older binary without the native module; nothing to do.
    }

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return null;
}

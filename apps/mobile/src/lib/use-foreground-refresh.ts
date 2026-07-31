import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Runs a refresh when the app comes back to the foreground after being away.
 *
 * Screens fetch on mount and never again, so an app left open for hours showed
 * whatever it had loaded — or stayed stuck on the error from a request that
 * failed while the phone was asleep, since nothing retried until the user
 * happened to pull-to-refresh.
 *
 * Only a real absence counts. iOS reports 'inactive' for momentary things like
 * the app switcher or a banner notification, and refetching every time the user
 * glanced at Control Centre would be wasteful.
 */
const MIN_BACKGROUND_MS = 30_000;

export function useForegroundRefresh(onForeground: () => void): void {
  const callback = useRef(onForeground);
  callback.current = onForeground;
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        const away = leftAt.current;
        leftAt.current = null;
        if (away !== null && Date.now() - away >= MIN_BACKGROUND_MS) callback.current();
      } else if (leftAt.current === null) {
        leftAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);
}

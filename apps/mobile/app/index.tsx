import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { theme } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { hasSeenWelcome } from '@/lib/first-run';

/**
 * Where a cold start lands.
 *
 * The welcome screen (design 09) is shown on a first run and only to someone
 * who is not signed in — two conditions, both doing work. An existing user
 * reinstalling after a crash should not be greeted as a stranger, and anyone
 * already signed in has plainly been here before, flag or no flag.
 *
 * Everyone else goes straight to the tabs, as the app always did.
 */
export default function Root() {
  const [seenWelcome, setSeenWelcome] = useState<boolean | null>(null);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    let cancelled = false;
    void hasSeenWelcome().then((v) => {
      if (!cancelled) setSeenWelcome(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Held, not redirected, while either answer is outstanding.
   *
   * Both are resolved in a frame or two — one local read and the session the
   * client already has. Redirecting to the tabs first and bouncing to welcome
   * afterwards would show the app and then take it away, which looks like a
   * bug even when it is brief. The ground matches the layout's own boot hold
   * so the two are one continuous colour.
   */
  if (seenWelcome === null || isPending) return <View style={styles.hold} />;

  if (!seenWelcome && !session) return <Redirect href="/welcome" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  hold: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
});

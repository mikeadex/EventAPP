import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts } from 'expo-font';
// Imported by weight subpath, not from the package root. Each root `index.js`
// `require()`s every weight at module scope and Metro does not tree-shake, so
// importing from the root would bundle all sixteen JetBrains Mono faces
// (1.78 MB of .ttf) to use two of them — 1.6 MB of dead weight in every OTA
// download. Verified with `expo export`: the bundle carries 22 .ttf, which is
// @expo/vector-icons' 19 plus exactly these three.
import { Alata_400Regular } from '@expo-google-fonts/alata/400Regular';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { color, spacing, radius, fontSize, fontWeight, theme } from '@ekklesia/ui/tokens';
import { ToastHost } from '@/components/toast';
import { PushHost } from '@/components/push-host';

/**
 * Root error boundary — expo-router renders this (instead of a redbox/blank
 * screen) when any route in the tree throws during render. `retry` re-mounts
 * the failed segment so a transient error can recover without a full reload.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errC}>
      <Ionicons name="alert-circle-outline" size={56} color={color.danger} />
      <Text style={styles.errTitle}>This screen hit a snag</Text>
      <Text style={styles.errMsg}>
        An unexpected error occurred. You can try again, and if it keeps
        happening please let us know.
      </Text>
      <ScrollView style={styles.errDetail} contentContainerStyle={{ padding: spacing[3] }}>
        <Text style={styles.errDetailText}>{error.message}</Text>
      </ScrollView>
      <Pressable style={styles.errBtn} onPress={retry}>
        <Ionicons name="refresh" size={16} color={color.ink[0]} />
        <Text style={styles.errBtnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  /**
   * The app has always rendered in the system face; the refresh moves it onto
   * Alata, with JetBrains Mono for ticket codes and numerics.
   *
   * These are bundled assets, not a network fetch, so the wait is a frame or
   * two. We hold on a plain themed ground rather than rendering the tree in
   * the system font and swapping — a visible reflow on every cold start is
   * worse than a brief flat colour.
   *
   * Deliberately no `expo-splash-screen`: it carries native code that is not
   * in the shipped iOS or Android binaries, so depending on it would turn this
   * whole refresh into a store release. `expo-font` is already in both.
   */
  const [fontsLoaded, fontError] = useFonts({
    Alata_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // On error, fall through to the system face rather than stranding the app on
  // a blank screen — wrong type is recoverable, no app is not.
  if (!fontsLoaded && !fontError) {
    return <View style={styles.boot} />;
  }

  return (
    /**
     * The publishable key is read from the build-time env, which is where
     * Expo inlines it. It is safe to ship — that is what "publishable" means —
     * and the API refuses to serve anything that does not start `pk_`.
     *
     * An empty string is tolerated rather than fatal: the app is mostly free
     * events, and a missing key should cost paid checkout, not the whole
     * application. Checkout surfaces the failure where it happens.
     */
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier={process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID}
    >
      <View style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          {/* Full-screen search slides up as a modal. */}
          <Stack.Screen name="search" options={{ presentation: 'modal' }} />
        </Stack>
        {/* Single host for showToast() — overlays every screen. */}
        <ToastHost />
        {/* Renders nothing; keeps the push token fresh and routes taps. */}
        <PushHost />
      </View>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  // Held for the frame or two the bundled fonts take to register.
  //
  // The dark ground, matching the screen that follows — NOT the light one. The
  // native splash behind this is cream (#FBF6EE, set in app.json) and is baked
  // into both shipped binaries, so it cannot be darkened over the air. A light
  // hold here would put a second, slightly different cream (#FFFAF9) between
  // that splash and a near-black Discover: two transitions where one will do.
  // Using the deep ground makes the cream-to-dark jump happen once, at JS
  // boot, and the hold continuous with what renders next.
  //
  // Darkening the splash itself is a store release — worth folding into the
  // next one rather than shipping a build for on its own.
  boot: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  errC: {
    flex: 1,
    backgroundColor: color.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[2],
  },
  errTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: color.ink[900],
    marginTop: spacing[2],
  },
  errMsg: {
    color: color.ink[500],
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
  errDetail: {
    maxHeight: 140,
    alignSelf: 'stretch',
    backgroundColor: color.ink[100],
    borderRadius: radius.md,
    marginTop: spacing[4],
  },
  errDetailText: {
    fontFamily: 'Courier',
    fontSize: fontSize.xs,
    color: color.ink[600],
  },
  errBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    backgroundColor: color.brand[600],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.md,
  },
  errBtnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
});

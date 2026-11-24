import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { radius, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Logo } from '@/components/logo';
import { Scrim } from '@/components/gradient';
import { markWelcomeSeen } from '@/lib/first-run';

/**
 * Design 09 — welcome.
 *
 * Shown once, on a first run, to someone who is not signed in. See
 * `app/index.tsx` for that decision; the short version is that this is a
 * brand moment, not a gate.
 *
 * The handoff gives it two controls, "Get started" and "Sign in". A third is
 * added here — browsing without an account is something the product promises
 * ("Browse as much as you like without an account", in the store listing) and
 * something App Review checks for, so a first run that offers only two routes
 * and both of them through an account would be a registration wall. It is
 * styled quietly, below the other two, because it is the escape rather than
 * the intent.
 */

/**
 * The handoff calls for a congregation photo, shot dark, full-bleed behind
 * the type. There isn't one in the repo and I'm not able to supply one, so
 * the screen ships on the flat ground and reads as a quieter version of the
 * same composition.
 *
 * To turn the photograph on: drop the file in `assets/` and make this
 * `require('../assets/welcome.jpg')`. Nothing else needs to change — the
 * scrim below is already the handoff's, and renders only when there is an
 * image for it to darken. Wants to be dark and roughly 1170x2100 or larger,
 * with its subject in the upper half; the bottom third is almost solid by
 * the time the gradient is done.
 */
const WELCOME_PHOTO: ImageSourcePropType | null = null;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  /**
   * Every route out of here marks the screen seen, including "look around".
   * Someone who chose to browse has made a decision; asking again next launch
   * would be ignoring it.
   *
   * The two account routes are pushed, not replaced, and that is the
   * difference between an invitation and a wall. The auth screens carry no
   * back control of their own — the root layout runs `headerShown: false` —
   * so replacing this screen with sign-up would leave the only route onward
   * being an account, with force-quitting the app as the sole way out.
   * Pushing keeps this screen underneath, so the gesture and the third option
   * both survive. Browsing replaces, because there is nothing here worth
   * coming back to once they are in the app.
   */
  function go(href: '/auth/sign-up' | '/auth/sign-in' | '/(tabs)') {
    void markWelcomeSeen();
    if (href === '/(tabs)') router.replace(href);
    else router.push(href);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {WELCOME_PHOTO ? (
        <View style={StyleSheet.absoluteFill}>
          <Image source={WELCOME_PHOTO} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Held back to near-opaque at the foot so the type sits on a
              settled ground rather than on whatever the photo is doing. */}
          <Scrim
            stops={[
              { at: 0, opacity: 0.55 },
              { at: 0.3, opacity: 0.4 },
              { at: 0.78, opacity: 0.97 },
              { at: 1, opacity: 0.97 },
            ]}
          />
        </View>
      ) : null}

      <View style={[styles.body, { paddingBottom: insets.bottom + 30 }]}>
        <View style={styles.pitch}>
          <Logo size={58} />
          <View style={styles.words}>
            {/* The break is the handoff's, not a wrap — "Find your / people"
                is two lines by intent at any width. */}
            <Text variant="hero" tone="onPhoto" style={styles.title}>
              Find your{'\n'}people
            </Text>
            <Text variant="bodyLg" tone="onPhotoMuted" style={styles.sub}>
              Church gatherings, courses and outreach — booked in a few taps.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => go('/auth/sign-up')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}
          >
            <Text variant="bodyLg" style={styles.ctaText}>
              Get started
            </Text>
          </Pressable>

          <Pressable
            onPress={() => go('/auth/sign-in')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          >
            <Text variant="body" tone="onPhotoMuted">
              Already have an account?{' '}
            </Text>
            <Text variant="body" tone="accent">
              Sign in
            </Text>
          </Pressable>

          <Pressable
            onPress={() => go('/(tabs)')}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => [styles.tertiary, pressed && { opacity: 0.7 }]}
          >
            <Text variant="label" tone="muted">
              Look around first
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  /** Bottom-anchored: the photograph, where there is one, owns the top. */
  body: { marginTop: 'auto', paddingHorizontal: 24, gap: 28 },
  pitch: { gap: 20 },
  words: { gap: 12 },
  /** 38/1.08 in the handoff, a step above the `hero` variant's 34. */
  title: { fontSize: 38, lineHeight: 41 },
  sub: { maxWidth: 290 },
  actions: { gap: 12 },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
  },
  ctaText: { color: palette.coral[200] },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  /**
   * 13pt type in a 4pt pad is a 26pt target — well under the 44pt minimum,
   * and it missed under a test tap aimed straight at the label. The padding
   * carries most of it and `hitSlop` covers the rest without moving the
   * layout.
   */
  tertiary: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
});

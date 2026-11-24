import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Logo } from '@/components/logo';
import { signUp } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/social-sign-in';
import { PasswordInput } from '@/components/password-input';
import { MIN_PASSWORD, passwordStrength } from '@/lib/password-strength';

/**
 * Design 13 — create account.
 *
 * Two departures from the handoff, both deliberate:
 *
 * The social buttons stay. Screen 13 does not draw them, which is coherent on
 * paper — they live on sign-in — but the welcome screen's primary action
 * lands here, so following the drawing exactly would give every new arrival a
 * password form and no Google or Apple option unless they first claimed to
 * have an account already.
 *
 * The two preference checkboxes are not here. "Email me about events from
 * hosts I follow" describes a feature that does not exist: there is no
 * follow anywhere in the schema or the app. "Send me the monthly Ekklesia
 * roundup" maps to `NotificationPreference.emailMarketing`, which exists as a
 * table and nothing else — no endpoint writes it, and sign-up returns no
 * session to write it with, since the account is unverified. A checkbox that
 * records nothing is worse than no checkbox when the thing it appears to
 * record is marketing consent.
 */
export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  const strength = passwordStrength(password);
  const canSubmit = firstName.trim().length > 0 && email.trim().length > 0 && strength.longEnough;

  async function submit() {
    setPending(true);
    setError(null);

    // The API stores one `name`. Splitting the field is a data-entry
    // decision, not a schema one — people fill two boxes more reliably than
    // one, and a last name left blank is still a usable name.
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    const res = await signUp.email({ name, email: email.trim(), password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Sign-up failed');
      return;
    }
    // Verification is required, so sign-up returns no session. Dropping someone
    // into the tabs here leaves them signed out with nothing explaining why,
    // and no idea an email is waiting for them.
    if (!res.data?.token) {
      setCheckYourEmail(true);
      return;
    }
    router.replace('/(tabs)');
  }

  if (checkYourEmail) {
    return (
      <View style={[styles.screen, styles.sent, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.sentTile}>
          <Ionicons name="mail-outline" size={27} color={theme.dark.accent} />
        </View>
        <Text variant="display" tone="onPhoto" style={styles.sentHeading}>
          Check your email
        </Text>
        <Text variant="body" tone="secondary" style={styles.sentBlurb}>
          We&rsquo;ve sent a verification link to {email.trim()}. Tap it to finish setting up your
          account, then sign in.
        </Text>
        <Text variant="label" tone="muted" style={styles.sentBlurb}>
          The link lasts 24 hours. If it doesn&rsquo;t arrive, check your spam folder — or try
          signing in, which will offer to send another.
        </Text>
        <Pressable
          style={[styles.cta, styles.sentCta]}
          onPress={() => router.replace('/auth/sign-in')}
        >
          <Text variant="bodyLg" style={styles.ctaText}>
            Go to sign in
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="footnote" tone="onPhotoMuted" style={styles.topTitle}>
          Create account
        </Text>
        <View style={styles.roundBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text variant="display" tone="onPhoto" style={styles.heading}>
            Set up your account
          </Text>
          <Text variant="body" tone="secondary">
            Takes about a minute.
          </Text>
        </View>

        <SocialSignIn onSignedIn={() => router.replace('/(tabs)')} />

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text variant="label" tone="onPhotoMuted">
                First name
              </Text>
              <TextInput
                textContentType="givenName"
                autoComplete="given-name"
                value={firstName}
                onChangeText={setFirstName}
                style={styles.input}
                placeholderTextColor={theme.dark.textMuted}
              />
            </View>
            <View style={styles.nameField}>
              <Text variant="label" tone="onPhotoMuted">
                Last name
              </Text>
              <TextInput
                textContentType="familyName"
                autoComplete="family-name"
                value={lastName}
                onChangeText={setLastName}
                style={styles.input}
                placeholderTextColor={theme.dark.textMuted}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text variant="label" tone="onPhotoMuted">
              Email address
            </Text>
            <TextInput
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholderTextColor={theme.dark.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text variant="label" tone="onPhotoMuted">
              Password
            </Text>
            <PasswordInput
              placeholder={`${MIN_PASSWORD} characters or more`}
              purpose="new"
              value={password}
              onChangeText={setPassword}
              containerStyle={styles.passwordBox}
            />
            {/* Four segments, filling as each rule is met. Rendered even when
                empty so the field does not change height on the first
                keystroke. */}
            <View style={styles.meter}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.segment, i < strength.score && styles.segmentOn]} />
              ))}
            </View>
            <Text variant="caption" tone="secondary">
              {strength.hint}
            </Text>
          </View>
        </View>

        {error ? (
          <Text variant="label" style={styles.error}>
            {error}
          </Text>
        ) : null}

        {/* Inside the scroll view, not pinned below it.
            Pinned, the form and the footer competed for whatever height the
            keyboard left, and the field being typed into was the part that
            lost — password, meter and hint all clipped out of sight the
            moment the keyboard appeared. `marginTop: auto` still holds it to
            the bottom when the content is short, which is all the handoff's
            pinning was ever doing. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 30 }]}>
          <Pressable
            onPress={() => void submit()}
            disabled={pending || !canSubmit}
            style={({ pressed }) => [
              styles.cta,
              (pending || pressed) && { opacity: 0.8 },
              !canSubmit && styles.ctaDisabled,
            ]}
          >
            {pending ? (
              <ActivityIndicator color={theme.dark.accent} />
            ) : (
              <Text variant="bodyLg" style={styles.ctaText}>
                Create account
              </Text>
            )}
          </Pressable>
          <Text variant="caption" tone="secondary" style={styles.legal}>
            By creating an account you agree to our Terms and Privacy Policy.
          </Text>
          <View style={styles.signInRow}>
            <Text variant="label" tone="secondary">
              Already have one?{' '}
            </Text>
            <Link href="/auth/sign-in">
              <Text variant="label" tone="accent">
                Sign in
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { letterSpacing: 2.1, textTransform: 'uppercase' },

  /** `flexGrow` so the footer's `marginTop: auto` has room to push against. */
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 30, gap: 22 },
  head: { gap: 10 },
  heading: { lineHeight: 34 },

  form: { gap: 15 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameField: { flex: 1, gap: 8 },
  field: { gap: 8 },
  input: {
    backgroundColor: theme.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.16)',
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },
  /** Matches `input`; PasswordInput draws its own box otherwise. */
  passwordBox: { marginBottom: 0 },

  meter: { flexDirection: 'row', gap: 5, paddingTop: 4 },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(249,142,128,0.18)',
  },
  segmentOn: { backgroundColor: theme.dark.accent },

  error: { color: '#D9A9A2' },

  footer: { marginTop: 'auto', paddingTop: 22, gap: 14 },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
  },
  ctaDisabled: { backgroundColor: 'transparent', borderColor: theme.dark.border },
  ctaText: { color: palette.coral[200] },
  legal: { textAlign: 'center', lineHeight: 19 },
  signInRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  /** The post-submit state (design 14's shape, inline). */
  sent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  sentTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(249,142,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentHeading: { paddingTop: 8, textAlign: 'center' },
  sentBlurb: { textAlign: 'center', maxWidth: 300 },
  sentCta: { alignSelf: 'stretch', marginTop: spacing[5] },
});

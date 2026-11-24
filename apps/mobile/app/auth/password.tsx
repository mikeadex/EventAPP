import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, Link, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { radius, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { PasswordInput } from '@/components/password-input';
import { signIn, sendVerificationEmail, protectSessionWithBiometrics } from '@/lib/auth-client';
import { canUseBiometricLock } from '@/lib/biometric-lock';
import { showToast } from '@/components/toast';

/**
 * Design 11 — sign in, step two.
 *
 * Every way this can fail needs the address, which is why the split works:
 * the resend offer, the hint about social accounts, and "Change" all have it
 * without asking twice.
 *
 * The handoff also puts a "Use Face ID next time" row at the foot of this
 * screen. It is not here: `expo-local-authentication` is in neither shipped
 * binary and is not even a dependency, so the row could only have been a
 * toggle that did nothing. See the commit for what it would actually take.
 */
export default function PasswordScreen() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set only for EMAIL_NOT_VERIFIED, so the offer to resend appears exactly
  // when it is the thing standing in the way.
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  // An account created through Google or Apple has no password at all, so a
  // password attempt on one fails exactly like a wrong password and the person
  // is left with nothing to act on. The hint names that possibility without
  // confirming the address exists or which method it uses, which would turn
  // this form into an account check.
  const [maybeSocial, setMaybeSocial] = useState(false);
  /**
   * Offered only where it can actually work — a device with biometrics
   * enrolled, running a binary whose Info.plist carries the Face ID string.
   * Resolved once, not per render: it reads native state and cannot change
   * while this screen is open.
   */
  const [biometricsOffered] = useState(canUseBiometricLock);
  const [useBiometrics, setUseBiometrics] = useState(false);

  async function submit() {
    if (!email) return;
    setPending(true);
    setError(null);
    setUnverified(false);
    setResent(false);
    setMaybeSocial(false);

    const res = await signIn.email({ email, password });
    setPending(false);

    if (res.error) {
      const code = (res.error as { code?: string }).code;
      const notVerified = code === 'EMAIL_NOT_VERIFIED';
      setUnverified(notVerified);
      setMaybeSocial(!notVerified);
      setError(
        notVerified
          ? 'Confirm your email before signing in. Check your inbox for the link.'
          : (res.error.message ?? 'Sign-in failed'),
      );
      return;
    }

    // After the session exists, never before — there is nothing to protect
    // until there is a token. A refusal here is not worth blocking on: they
    // are signed in, and the switch not sticking is a smaller problem than
    // being held on a sign-in screen that already succeeded.
    if (useBiometrics) {
      const locked = await protectSessionWithBiometrics();
      if (!locked) showToast('Signed in, but Face ID could not be set up');
    }

    router.replace('/(tabs)');
  }

  /** Without this, losing the confirmation email leaves the account unusable. */
  async function resend() {
    if (!email) return;
    setPending(true);
    await sendVerificationEmail({ email }).catch(() => {
      /* Same generic outcome either way — never reveal whether the address exists. */
    });
    setPending(false);
    setResent(true);
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
          Sign in
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
            Enter your password
          </Text>
          {/* "Change" goes back rather than forward to a fresh screen, so the
              address already typed is still in the field behind this one. */}
          <View style={styles.whoRow}>
            <Text variant="footnote" tone="secondary" numberOfLines={1} style={styles.who}>
              {email}
            </Text>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text variant="footnote" tone="accent">
                Change
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text variant="footnote" tone="onPhotoMuted">
            Password
          </Text>
          <PasswordInput
            placeholder="Your password"
            purpose="current"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
            autoFocus
          />
          <Link href="/auth/forgot-password" style={styles.forgot}>
            <Text variant="footnote" tone="accent">
              Forgot password?
            </Text>
          </Link>
        </View>

        {error ? (
          <Text variant="label" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {maybeSocial ? (
          <Text variant="label" style={styles.hint}>
            If you created this account with Google or Apple, go back and use that button — those
            accounts don’t have a password.
          </Text>
        ) : null}
        {unverified && !resent ? (
          <Pressable onPress={() => void resend()} disabled={pending} hitSlop={8}>
            <Text variant="label" tone="accent">
              Resend confirmation email
            </Text>
          </Pressable>
        ) : null}
        {resent ? (
          <Text variant="label" tone="secondary">
            Confirmation email sent — check your inbox.
          </Text>
        ) : null}

        <Pressable
          onPress={() => void submit()}
          disabled={pending || !password}
          style={({ pressed }) => [
            styles.cta,
            (pending || pressed) && { opacity: 0.8 },
            !password && styles.ctaDisabled,
          ]}
        >
          {pending ? (
            <ActivityIndicator color={theme.dark.accent} />
          ) : (
            <Text variant="bodyLg" style={styles.ctaText}>
              Sign in
            </Text>
          )}
        </Pressable>

        {/* Hidden rather than disabled where it cannot work: a greyed switch
            invites "why not?", and the answer — which build you are on — is
            not something anyone can act on. */}
        {biometricsOffered ? (
          <Pressable
            onPress={() => setUseBiometrics((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: useBiometrics }}
            accessibilityLabel="Use Face ID next time"
            style={styles.bioRow}
          >
            <Ionicons name="lock-closed" size={19} color={theme.dark.accent} />
            <Text variant="footnote" tone="onPhotoMuted" style={styles.bioLabel}>
              Use Face ID next time
            </Text>
            <View style={[styles.switch, useBiometrics && styles.switchOn]}>
              <View style={[styles.knob, useBiometrics && styles.knobOn]} />
            </View>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 30 }]}>
        <Text variant="body" tone="secondary">
          New here?{' '}
        </Text>
        <Link href={'/auth/sign-up' as never}>
          <Text variant="body" tone="accent">
            Create an account
          </Text>
        </Link>
      </View>
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

  body: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24, gap: 22 },
  head: { gap: 10 },
  heading: { lineHeight: 34 },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  /** Shrinks rather than pushing "Change" off the edge on a long address. */
  who: { flexShrink: 1 },

  field: { gap: 9 },
  forgot: { alignSelf: 'flex-end', paddingTop: 4 },

  error: { color: '#D9A9A2' },
  hint: { color: theme.dark.textSecondary, lineHeight: 21 },

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

  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.14)',
  },
  bioLabel: { flex: 1, lineHeight: 21 },
  /** Hand-drawn rather than RN's Switch, which cannot take these colours. */
  switch: {
    width: 48,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.25)',
    backgroundColor: 'rgba(249,142,128,0.08)',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: {
    borderColor: 'rgba(249,142,128,0.5)',
    backgroundColor: 'rgba(249,142,128,0.2)',
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.warm[550],
    alignSelf: 'flex-start',
  },
  knobOn: { backgroundColor: theme.dark.accent, alignSelf: 'flex-end' },

  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

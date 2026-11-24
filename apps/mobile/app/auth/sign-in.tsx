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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { radius, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Logo } from '@/components/logo';
import { SocialSignIn } from '@/components/social-sign-in';
import { emailOtp } from '@/lib/auth-client';

/**
 * Design 10 — sign in, step one.
 *
 * Asks for the address and nothing else. The password lives on its own screen
 * (design 11, `password.tsx`), which is what lets this one lead with Apple and
 * Google: most people arriving have one of those and no password with us, and
 * a password field sitting here would be the largest thing on screen for the
 * minority who do.
 *
 * Splitting also means the address is known by the time anything can fail, so
 * the failures that need it — the code route, the social-account hint — have
 * it to hand rather than having to ask again.
 *
 * Deliberately does NOT check whether the address has an account before moving
 * on. That check is the whole mechanism of an account-enumeration oracle, and
 * it would be running on an unauthenticated endpoint against any address
 * anyone cared to type.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);

  function continueWithEmail() {
    const address = email.trim();
    if (!address) {
      setError('Enter your email address to carry on.');
      return;
    }
    setError(null);
    router.push({ pathname: '/auth/password', params: { email: address } });
  }

  /**
   * Navigates whether or not a code was actually sent. The API answers the
   * same for an address with an account and one without — see the `emailOTP`
   * plugin — and reporting the difference here would undo that. Only a send
   * that failed on our side is worth saying out loud.
   */
  async function sendCode() {
    const address = email.trim();
    if (!address) {
      setError('Enter your email address first, then we’ll send you a code.');
      return;
    }
    setSendingCode(true);
    setError(null);
    const res = await emailOtp.sendVerificationOtp({ email: address, type: 'sign-in' });
    setSendingCode(false);

    if (res.error && res.error.status !== 400) {
      setError('Could not send a code just now. Try again, or use your password.');
      return;
    }
    router.push({ pathname: '/auth/email-code', params: { email: address } });
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
        <Logo size={28} />
        <View style={styles.roundBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text variant="hero" tone="onPhoto">
            Welcome back
          </Text>
          <Text variant="body" tone="secondary">
            Sign in to see your tickets and saved events.
          </Text>
        </View>

        <View style={styles.form}>
          <SocialSignIn onSignedIn={() => router.replace('/(tabs)')} />

          <View style={styles.field}>
            <Text variant="footnote" tone="onPhotoMuted">
              Email address
            </Text>
            <TextInput
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              // The account identifier half of a credential pair, which is
              // what makes the device offer to save the password alongside it
              // and fill both back in next time.
              textContentType="username"
              autoComplete="email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(null);
              }}
              onSubmitEditing={continueWithEmail}
              returnKeyType="next"
              style={styles.input}
              placeholderTextColor={theme.dark.textMuted}
            />
          </View>

          {error ? (
            <Text variant="label" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={continueWithEmail}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]}
          >
            <Text variant="bodyLg" style={styles.ctaText}>
              Continue with email
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void sendCode()}
            disabled={sendingCode}
            hitSlop={8}
            style={({ pressed }) => [styles.codeLink, pressed && { opacity: 0.7 }]}
          >
            {sendingCode ? (
              <ActivityIndicator color={theme.dark.accent} size="small" />
            ) : (
              <>
                <Ionicons name="mail-outline" size={15} color={theme.dark.accent} />
                <Text variant="footnote" tone="accent">
                  Email me a sign-in code instead
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.legal, { paddingBottom: insets.bottom + 30 }]}>
        <Text variant="caption" tone="secondary" style={styles.legalText}>
          By continuing you agree to our Terms and Privacy Policy.
        </Text>
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
  body: { paddingHorizontal: 24, paddingTop: 44, paddingBottom: 24 },
  head: { gap: 10 },
  form: { paddingTop: 36, gap: 12 },
  field: { gap: 9 },
  input: {
    backgroundColor: theme.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 15,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },
  error: { color: '#D9A9A2' },
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
  codeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  legal: { paddingHorizontal: 32 },
  legalText: { textAlign: 'center', lineHeight: 19 },
});

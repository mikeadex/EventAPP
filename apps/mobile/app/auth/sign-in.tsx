import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  
  TextInput,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import { spacing, theme } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { authStyles } from '@/components/auth-styles';
import { signIn, sendVerificationEmail } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/social-sign-in';
import { PasswordInput } from '@/components/password-input';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set only for EMAIL_NOT_VERIFIED, so the offer to resend appears exactly
  // when it is the thing standing in the way.
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  // An account created through Google or Apple has no password at all, so a
  // password attempt on one fails exactly like a wrong password and the
  // person is left with nothing to act on — the social buttons are already on
  // this screen, but no reason to think they are the answer. The hint below
  // names that possibility without confirming the address exists or which
  // method it uses, which would turn this form into an account check.
  const [maybeSocial, setMaybeSocial] = useState(false);

  async function submit() {
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
    router.replace('/(tabs)');
  }

  /** Without this, losing the confirmation email leaves the account unusable. */
  async function resend() {
    setPending(true);
    await sendVerificationEmail({ email }).catch(() => {
      /* Same generic outcome either way — never reveal whether the address exists. */
    });
    setPending(false);
    setResent(true);
  }

  return (
    <KeyboardAvoidingView
      style={authStyles.c}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text variant="display" tone="onPhoto" style={authStyles.h}>Welcome back</Text>
      <Text variant="bodyLg" tone="secondary" style={authStyles.m}>Sign in to RSVP and save events.</Text>

      <TextInput
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        // `username` rather than `emailAddress`: it is the account identifier
        // half of a credential pair, and it is what makes the device offer to
        // save the password alongside it and fill both back in next time.
        textContentType="username"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        style={authStyles.input}
        placeholderTextColor={theme.dark.textMuted}
      />
      <PasswordInput
        placeholder="Password"
        purpose="current"
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text variant="label" style={authStyles.error}>{error}</Text>}
      {maybeSocial && (
        <Text variant="label" style={authStyles.hint}>
          If you created this account with one of the buttons below, sign in that way —
          those accounts don&rsquo;t have a password.
        </Text>
      )}
      {unverified && !resent && (
        <Pressable onPress={() => void resend()} disabled={pending} style={authStyles.resend}>
          <Text variant="label" style={authStyles.link}>Resend confirmation email</Text>
        </Pressable>
      )}
      {resent && <Text variant="label" style={authStyles.sent}>Confirmation email sent — check your inbox.</Text>}

      <Link href="/auth/forgot-password" style={authStyles.forgot}>
        <Text variant="label" style={authStyles.link}>Forgot password?</Text>
      </Link>

      <Pressable style={authStyles.btn} onPress={submit} disabled={pending}>
        {pending ? (
          <ActivityIndicator color={theme.dark.accent} />
        ) : (
          <Text variant="bodyLg" style={authStyles.btnText}>Sign in</Text>
        )}
      </Pressable>

      <SocialSignIn onSignedIn={() => router.replace('/(tabs)')} />

      <View style={{ marginTop: spacing[6], flexDirection: 'row' }}>
        <Text variant="label" style={authStyles.muted}>New here? </Text>
        <Link href={'/auth/sign-up' as never}>
          <Text variant="label" style={authStyles.link}>Create an account</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}


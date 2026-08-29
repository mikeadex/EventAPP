import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { signIn, sendVerificationEmail } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/social-sign-in';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set only for EMAIL_NOT_VERIFIED, so the offer to resend appears exactly
  // when it is the thing standing in the way.
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    setUnverified(false);
    setResent(false);
    const res = await signIn.email({ email, password });
    setPending(false);
    if (res.error) {
      const code = (res.error as { code?: string }).code;
      setUnverified(code === 'EMAIL_NOT_VERIFIED');
      setError(
        code === 'EMAIL_NOT_VERIFIED'
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
      style={styles.c}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.h}>Welcome back</Text>
      <Text style={styles.m}>Sign in to RSVP and save events.</Text>

      <TextInput
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {unverified && !resent && (
        <Pressable onPress={() => void resend()} disabled={pending} style={styles.resend}>
          <Text style={styles.link}>Resend confirmation email</Text>
        </Pressable>
      )}
      {resent && <Text style={styles.sent}>Confirmation email sent — check your inbox.</Text>}

      <Link href="/auth/forgot-password" style={styles.forgot}>
        <Text style={styles.link}>Forgot password?</Text>
      </Link>

      <Pressable style={styles.btn} onPress={submit} disabled={pending}>
        {pending ? (
          <ActivityIndicator color={color.ink[0]} />
        ) : (
          <Text style={styles.btnText}>Sign in</Text>
        )}
      </Pressable>

      <SocialSignIn onSignedIn={() => router.replace('/(tabs)')} />

      <View style={{ marginTop: spacing[6], flexDirection: 'row' }}>
        <Text style={styles.muted}>New here? </Text>
        <Link href={'/auth/sign-up' as never}>
          <Text style={styles.link}>Create an account</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[50], padding: spacing[6], justifyContent: 'center' },
  h: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: color.ink[900] },
  m: { color: color.ink[500], marginTop: spacing[1], marginBottom: spacing[6] },
  input: {
    backgroundColor: color.ink[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink[200],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
  },
  error: { color: color.danger, marginBottom: spacing[3], fontSize: fontSize.sm },
  resend: { marginBottom: spacing[3] },
  sent: { color: color.ink[500], marginBottom: spacing[3], fontSize: fontSize.sm },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing[4] },
  btn: {
    backgroundColor: color.brand[600],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  muted: { color: color.ink[500] },
  link: { color: color.brand[600], fontWeight: fontWeight.medium },
});

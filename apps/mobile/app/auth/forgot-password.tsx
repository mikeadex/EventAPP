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
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { requestPasswordReset } from '@/lib/auth-client';

// Deep link the reset email returns to. Better Auth verifies the token at its
// own endpoint, then redirects here (`ekklesia://auth/reset-password?token=…`),
// which expo-router routes to app/auth/reset-password.tsx. The bare scheme is in
// the API's trustedOrigins.
const RESET_REDIRECT = 'ekklesia://auth/reset-password';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await requestPasswordReset({ email, redirectTo: RESET_REDIRECT });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Could not send reset email');
      return;
    }
    // Always show success even if the email isn't registered — don't leak which
    // addresses have accounts.
    setSent(true);
  }

  if (sent) {
    return (
      <View style={[styles.c, styles.center]}>
        <Ionicons name="mail-outline" size={48} color={color.brand[600]} />
        <Text style={styles.h}>Check your email</Text>
        <Text style={[styles.m, { textAlign: 'center' }]}>
          If an account exists for {email}, we&apos;ve sent a link to reset your
          password. It expires in 1 hour.
        </Text>
        <Link href="/auth/sign-in" asChild>
          <Pressable style={[styles.btn, { marginTop: spacing[6] }]}>
            <Text style={styles.btnText}>Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.c}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.h}>Reset password</Text>
      <Text style={styles.m}>
        Enter your account email and we&apos;ll send you a link to set a new
        password.
      </Text>

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

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.btn} onPress={submit} disabled={pending || !email}>
        {pending ? (
          <ActivityIndicator color={color.ink[0]} />
        ) : (
          <Text style={styles.btnText}>Send reset link</Text>
        )}
      </Pressable>

      <View style={{ marginTop: spacing[6], flexDirection: 'row' }}>
        <Text style={styles.muted}>Remembered it? </Text>
        <Link href="/auth/sign-in">
          <Text style={styles.link}>Sign in</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[50], padding: spacing[6], justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing[2] },
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
  btn: {
    backgroundColor: color.brand[600],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  muted: { color: color.ink[500] },
  link: { color: color.brand[600], fontWeight: fontWeight.medium },
});

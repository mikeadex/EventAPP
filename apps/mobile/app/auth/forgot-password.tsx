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
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, theme } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { authStyles } from '@/components/auth-styles';
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
      <View style={[authStyles.c, authStyles.center]}>
        <Ionicons name="mail-outline" size={48} color={theme.dark.accent} />
        <Text variant="display" tone="onPhoto" style={authStyles.h}>Check your email</Text>
        <Text style={[authStyles.m, { textAlign: 'center' }]}>
          If an account exists for {email}, we&apos;ve sent a link to reset your
          password. It expires in 1 hour.
        </Text>
        <Link href="/auth/sign-in" asChild>
          <Pressable style={[authStyles.btn, { marginTop: spacing[6] }]}>
            <Text variant="bodyLg" style={authStyles.btnText}>Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={authStyles.c}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text variant="display" tone="onPhoto" style={authStyles.h}>Reset password</Text>
      <Text variant="bodyLg" tone="secondary" style={authStyles.m}>
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
        style={authStyles.input}
        placeholderTextColor={theme.dark.textMuted}
      />

      {error && <Text variant="label" style={authStyles.error}>{error}</Text>}

      <Pressable style={authStyles.btn} onPress={submit} disabled={pending || !email}>
        {pending ? (
          <ActivityIndicator color={theme.dark.accent} />
        ) : (
          <Text variant="bodyLg" style={authStyles.btnText}>Send reset link</Text>
        )}
      </Pressable>

      <View style={{ marginTop: spacing[6], flexDirection: 'row' }}>
        <Text variant="label" style={authStyles.muted}>Remembered it? </Text>
        <Link href="/auth/sign-in">
          <Text variant="label" style={authStyles.link}>Sign in</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}


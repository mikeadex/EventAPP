import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { authStyles } from '@/components/auth-styles';
import { PasswordInput } from '@/components/password-input';
import { resetPassword } from '@/lib/auth-client';
import { Logo } from '@/components/logo';

const MIN_PASSWORD = 12;

export default function ResetPasswordScreen() {
  // Better Auth deep-links back with the verified token (and `error` if the
  // link was invalid/expired).
  const { token, error: linkError } = useLocalSearchParams<{
    token?: string;
    error?: string;
  }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidLink = !token || !!linkError;

  async function submit() {
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Could not reset password');
      return;
    }
    router.replace('/auth/sign-in');
  }

  if (invalidLink) {
    return (
      <View style={[authStyles.c, authStyles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={palette.coral[500]} />
        <Text variant="display" tone="onPhoto" style={authStyles.h}>Link expired</Text>
        <Text style={[authStyles.m, { textAlign: 'center' }]}>
          This password reset link is invalid or has expired. Request a fresh one
          to continue.
        </Text>
        <Link href="/auth/forgot-password" asChild>
          <Pressable style={[authStyles.btn, { marginTop: spacing[6] }]}>
            <Text variant="bodyLg" style={authStyles.btnText}>Request a new link</Text>
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
      <Logo size={44} style={authStyles.logo} />
      <Text variant="display" tone="onPhoto" style={authStyles.h}>Set a new password</Text>
      <Text variant="bodyLg" tone="secondary" style={authStyles.m}>Choose a strong password you don&apos;t use elsewhere.</Text>

      <PasswordInput
        placeholder={`New password (${MIN_PASSWORD}+ chars)`}
        purpose="new"
        value={password}
        onChangeText={setPassword}
      />
      <PasswordInput
        placeholder="Confirm new password"
        purpose="new"
        value={confirm}
        onChangeText={setConfirm}
      />

      {error && <Text variant="label" style={authStyles.error}>{error}</Text>}

      <Pressable
        style={authStyles.btn}
        onPress={submit}
        disabled={pending || !password || !confirm}
      >
        {pending ? (
          <ActivityIndicator color={theme.dark.accent} />
        ) : (
          <Text variant="bodyLg" style={authStyles.btnText}>Reset password</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}


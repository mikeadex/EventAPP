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
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { resetPassword } from '@/lib/auth-client';

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
      <View style={[styles.c, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={color.danger} />
        <Text style={styles.h}>Link expired</Text>
        <Text style={[styles.m, { textAlign: 'center' }]}>
          This password reset link is invalid or has expired. Request a fresh one
          to continue.
        </Text>
        <Link href="/auth/forgot-password" asChild>
          <Pressable style={[styles.btn, { marginTop: spacing[6] }]}>
            <Text style={styles.btnText}>Request a new link</Text>
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
      <Text style={styles.h}>Set a new password</Text>
      <Text style={styles.m}>Choose a strong password you don&apos;t use elsewhere.</Text>

      <TextInput
        placeholder={`New password (${MIN_PASSWORD}+ chars)`}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />
      <TextInput
        placeholder="Confirm new password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.btn}
        onPress={submit}
        disabled={pending || !password || !confirm}
      >
        {pending ? (
          <ActivityIndicator color={color.ink[0]} />
        ) : (
          <Text style={styles.btnText}>Reset password</Text>
        )}
      </Pressable>
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
});

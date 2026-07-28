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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { changePassword } from '@/lib/auth-client';

const MIN_LENGTH = 8;

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !pending;

  async function submit() {
    setPending(true);
    setError(null);
    const res = await changePassword({
      currentPassword: current,
      newPassword: next,
      // Keep this session signed in (the bearer token stays valid), but revoke
      // any other devices as a safety measure.
      revokeOtherSessions: true,
    });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Could not change password');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <View style={[styles.c, styles.center]}>
        <Ionicons name="shield-checkmark-outline" size={48} color={color.ink[900]} />
        <Text style={styles.h}>Password changed</Text>
        <Text style={styles.doneMsg}>
          Your password has been updated. Other signed-in devices have been signed out.
        </Text>
        <Pressable style={[styles.btn, { alignSelf: 'stretch' }]} onPress={() => router.back()}>
          <Text style={styles.btnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.c, { paddingTop: insets.top + spacing[2] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.h}>Change password</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.fieldLabel}>Current password</Text>
      <TextInput
        value={current}
        onChangeText={setCurrent}
        placeholder="Current password"
        placeholderTextColor={color.ink[300]}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.fieldLabel}>New password</Text>
      <TextInput
        value={next}
        onChangeText={setNext}
        placeholder={`At least ${MIN_LENGTH} characters`}
        placeholderTextColor={color.ink[300]}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />
      {tooShort ? (
        <Text style={styles.hintWarn}>Must be at least {MIN_LENGTH} characters.</Text>
      ) : null}

      <Text style={styles.fieldLabel}>Confirm new password</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Repeat new password"
        placeholderTextColor={color.ink[300]}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />
      {mismatch ? <Text style={styles.hintWarn}>Passwords don&apos;t match.</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={submit}
        disabled={!canSubmit}
      >
        {pending ? (
          <ActivityIndicator color={color.ink[0]} />
        ) : (
          <Text style={styles.btnText}>Update password</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0], paddingHorizontal: spacing[4] },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing[3], padding: spacing[6] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  h: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink[900] },

  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: color.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    marginTop: spacing[4],
  },
  input: {
    backgroundColor: color.ink[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink[200],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
  },
  hintWarn: { fontSize: fontSize.xs, color: color.danger, marginTop: spacing[1] },
  error: { color: color.danger, marginTop: spacing[4], fontSize: fontSize.sm },
  doneMsg: {
    color: color.ink[500],
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 300,
  },

  btn: {
    backgroundColor: color.ink[900],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    alignItems: 'center',
    marginTop: spacing[6],
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
});

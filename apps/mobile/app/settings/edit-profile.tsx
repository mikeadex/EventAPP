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
import { updateUser, useSession } from '@/lib/auth-client';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== (session?.user?.name ?? '');

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await updateUser({ name: trimmed });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Could not update profile');
      return;
    }
    setSaved(true);
  }

  const initial = (trimmed || session?.user?.email || '?').charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={[styles.c, { paddingTop: insets.top + spacing[2] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.h}>Edit profile</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.avatarWrap}>
        <View style={styles.avatarLg}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Display name</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setSaved(false);
        }}
        placeholder="Your name"
        placeholderTextColor={color.ink[300]}
        style={styles.input}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={80}
      />

      <Text style={styles.fieldLabel}>Email</Text>
      <View style={[styles.input, styles.inputDisabled]}>
        <Text style={styles.inputDisabledText}>{session?.user?.email ?? ''}</Text>
      </View>
      <Text style={styles.hint}>Email changes aren&apos;t supported yet.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? (
        <View style={styles.savedRow}>
          <Ionicons name="checkmark-circle" size={16} color={color.ink[900]} />
          <Text style={styles.savedText}>Profile updated</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.btn, (!dirty || pending) && styles.btnDisabled]}
        onPress={save}
        disabled={!dirty || pending}
      >
        {pending ? (
          <ActivityIndicator color={color.ink[0]} />
        ) : (
          <Text style={styles.btnText}>Save changes</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0], paddingHorizontal: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  h: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink[900] },

  avatarWrap: { alignItems: 'center', marginVertical: spacing[5] },
  avatarLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, color: color.ink[900] },

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
  inputDisabled: { backgroundColor: color.ink[50] },
  inputDisabledText: { fontSize: fontSize.base, color: color.ink[400] },
  hint: { fontSize: fontSize.xs, color: color.ink[400], marginTop: spacing[1] },

  error: { color: color.danger, marginTop: spacing[3], fontSize: fontSize.sm },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[3],
  },
  savedText: { color: color.ink[900], fontSize: fontSize.sm, fontWeight: fontWeight.medium },

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

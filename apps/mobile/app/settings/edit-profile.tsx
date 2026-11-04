import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { canPickImages, pickImages, uploadImage } from '@/lib/upload';
import { showToast } from '@/components/toast';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name ?? '');
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentImage = session?.user?.image ?? null;
  const [image, setImage] = useState<string | null>(currentImage);

  const trimmed = name.trim();
  const dirty =
    (trimmed.length > 0 && trimmed !== (session?.user?.name ?? '')) || image !== currentImage;

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    // Send both every time: the picture and the name are one "save" to the
    // person pressing the button, and a partial update would leave the screen
    // showing something that is not what was stored.
    const res = await updateUser({ name: trimmed, image });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Could not update profile');
      return;
    }
    setSaved(true);
  }

  /** Upload happens on pick; `save` only stores the resulting URL. */
  async function choosePhoto() {
    const picked = await pickImages({ multiple: false });
    if (!picked.ok) {
      if (picked.reason === 'denied') showToast('Allow photo access to set a picture');
      if (picked.reason === 'unsupported') showToast('Update the app to add a picture');
      return;
    }
    const chosen = picked.images[0];
    if (!chosen) return;

    setUploading(true);
    const up = await uploadImage(chosen, 'user_avatar');
    setUploading(false);

    if (up.ok) {
      setImage(up.url);
      setSaved(false);
      return;
    }
    if (up.reason === 'unavailable') {
      showToast('Photos are unavailable right now — try again later');
      return;
    }
    showToast(up.message ?? "Couldn't upload that photo");
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
        <Pressable
          style={styles.avatarLg}
          disabled={!canPickImages() || uploading || pending}
          onPress={() => void choosePhoto()}
          accessibilityRole="button"
          accessibilityLabel={image ? 'Change your picture' : 'Add a picture'}
        >
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
          {uploading ? (
            <View style={[StyleSheet.absoluteFill, styles.avatarBusy]}>
              <ActivityIndicator color={color.ink[0]} />
            </View>
          ) : canPickImages() ? (
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color={color.ink[0]} />
            </View>
          ) : null}
        </Pressable>
        {image && canPickImages() ? (
          <Pressable onPress={() => setImage(null)} hitSlop={8} disabled={pending}>
            <Text style={styles.removePhoto}>Remove photo</Text>
          </Pressable>
        ) : null}
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

  avatarWrap: { alignItems: 'center', marginVertical: spacing[5], gap: spacing[2] },
  avatarLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, color: color.ink[900] },
  avatarBusy: {
    backgroundColor: 'rgba(10,9,7,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.ink[0],
  },
  removePhoto: { fontSize: fontSize.xs, color: color.ink[500], fontWeight: fontWeight.medium },

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

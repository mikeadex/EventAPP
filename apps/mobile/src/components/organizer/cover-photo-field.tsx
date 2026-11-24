import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { canPickImages, pickImages, uploadImage } from '@/lib/upload';
import { showToast } from '@/components/toast';

/**
 * Pick a cover photo while the event is being written, rather than afterwards.
 *
 * Until now the only way to put a picture on an event was a separate gallery
 * screen reachable from the event editor — which exists only once the event
 * does. The result is visible in production: the one organisation actually
 * using the app has published three events and not one of them has an image,
 * so every card falls back to a grey calendar glyph on a feed whose whole
 * design is photographs.
 *
 * Nothing here can block saving. An event with no picture is worse than one
 * with a picture and far better than one nobody finished writing, so every
 * failure path ends in a toast and an unchanged form.
 */
export function CoverPhotoField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  // An install built before expo-image-picker existed has no picker to open.
  // Showing a button that cannot work is worse than showing nothing.
  if (!canPickImages()) return null;

  async function choose() {
    const picked = await pickImages({ multiple: false });
    if (!picked.ok) {
      if (picked.reason === 'denied') showToast('Allow photo access to add a cover');
      if (picked.reason === 'unsupported') showToast('Update the app to add photos');
      return;
    }
    const image = picked.images[0];
    if (!image) return;

    setBusy(true);
    const up = await uploadImage(image, 'event_cover');
    setBusy(false);

    if (up.ok) {
      onChange(up.url);
      return;
    }
    if (up.reason === 'unavailable') {
      // Storage is not configured. Nothing the organiser does will fix that,
      // so do not invite a retry — say it is us, and let them carry on.
      showToast('Photos are unavailable right now — you can add one later');
      return;
    }
    showToast(up.message ?? "Couldn't upload that photo");
  }

  return (
    <View>
      <Text style={styles.label}>Cover photo</Text>
      <Text style={styles.hint}>
        This is the picture people see on the feed. Events without one are easy to scroll past.
      </Text>

      {value ? (
        <View style={styles.preview}>
          <Image source={{ uri: value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.previewActions}>
            <Pressable
              style={styles.pill}
              disabled={disabled || busy}
              onPress={() => void choose()}
            >
              <Ionicons name="swap-horizontal" size={15} color={theme.dark.textPrimary} />
              <Text style={styles.pillText}>Change</Text>
            </Pressable>
            <Pressable
              style={styles.pill}
              disabled={disabled || busy}
              onPress={() => onChange(null)}
              accessibilityLabel="Remove cover photo"
            >
              <Ionicons name="trash-outline" size={15} color={theme.dark.textPrimary} />
              <Text style={styles.pillText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.placeholder, (disabled || busy) && { opacity: 0.6 }]}
          disabled={disabled || busy}
          onPress={() => void choose()}
          accessibilityRole="button"
          accessibilityLabel="Add a cover photo"
        >
          {busy ? (
            <>
              <ActivityIndicator color={theme.dark.textSecondary} />
              <Text style={styles.placeholderText}>Uploading…</Text>
            </>
          ) : (
            <>
              <Ionicons name="image-outline" size={26} color={theme.dark.textMuted} />
              <Text style={styles.placeholderText}>Add a cover photo</Text>
              <Text style={styles.placeholderSub}>Optional, but it makes a real difference</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.sm,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
    marginBottom: spacing[1],
  },
  hint: { fontSize: fontSize.xs, color: theme.dark.textMuted, marginBottom: spacing[2] },
  placeholder: {
    height: 150,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderStyle: 'dashed',
    backgroundColor: theme.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  placeholderText: {
    fontSize: fontSize.sm,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textSecondary,
  },
  placeholderSub: { fontSize: fontSize.xs, color: theme.dark.textMuted },
  preview: {
    height: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.dark.surfaceRaised,
    justifyContent: 'flex-end',
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[2],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: theme.dark.backgroundDeep,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  pillText: {
    fontSize: fontSize.xs,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },
});

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { pickImages, uploadImage, canPickImages } from '@/lib/upload';
import { showToast } from '@/components/toast';
import { EmptyState, ErrorState } from '@/components/states';

interface Media {
  id: string;
  kind: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  position: number;
  embedUrl?: string;
}

/**
 * The gallery a host builds for their event.
 *
 * Reordering is up/down buttons rather than drag-and-drop. Dragging inside a
 * ScrollView needs a gesture handler and careful conflict resolution with the
 * scroll itself, and on a list of ten thumbnails the buttons are faster to hit
 * and far easier to use one-handed — which is how a host on a phone actually
 * does this.
 *
 * Order is sent as the whole list after every move, matching the API. A dropped
 * request then leaves the gallery as it was rather than half-shuffled.
 */
export default function MediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [media, event] = await Promise.all([
        api<Media[]>(`/v1/events/${id}/media`),
        api<{ coverImageUrl: string | null }>(`/v1/events/${id}`),
      ]);
      setItems(media);
      setCoverUrl(event.coverImageUrl);
      setError(null);
    } catch (e) {
      setError(describeApiError(e, 'Could not load the gallery'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPhotos() {
    const picked = await pickImages({ multiple: true });
    if (!picked.ok) {
      if (picked.reason === 'denied') showToast('Allow photo access to add pictures');
      if (picked.reason === 'unsupported') showToast('Update the app to add photos');
      return;
    }

    setBusy(true);
    let added = 0;
    // Sequential, not parallel: several 8 MB uploads at once on mobile data
    // tend to time out together, and one failure mid-way is easier to explain
    // when the earlier ones have already landed.
    for (const image of picked.images) {
      const up = await uploadImage(image, 'event_cover');
      if (!up.ok) {
        showToast(up.message ?? 'Upload failed');
        break;
      }
      try {
        await api(`/v1/events/${id}/media`, {
          method: 'POST',
          body: { kind: 'IMAGE', url: up.url },
        });
        added += 1;
      } catch (e) {
        showToast(describeApiError(e, 'Could not save that photo'));
        break;
      }
    }
    setBusy(false);
    if (added) showToast(`Added ${added} ${added === 1 ? 'photo' : 'photos'}`);
    await load();
  }

  async function addVideo() {
    const link = videoUrl.trim();
    if (!link) return;
    setBusy(true);
    try {
      await api(`/v1/events/${id}/media`, {
        method: 'POST',
        body: { kind: 'VIDEO', url: link },
      });
      setVideoUrl('');
      await load();
      showToast('Video added');
    } catch (e) {
      // The server explains what it could not parse; pass that through rather
      // than replacing it with something vaguer.
      showToast(describeApiError(e, 'Could not add that video'));
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];

    // Optimistic: the reorder is the whole point of the tap, and waiting for a
    // round trip before the thumbnail moves feels broken.
    setItems(next);
    try {
      await api(`/v1/events/${id}/media/reorder`, {
        method: 'PATCH',
        body: { ids: next.map((m) => m.id) },
      });
    } catch (e) {
      showToast(describeApiError(e, 'Could not save the new order'));
      await load();
    }
  }

  async function remove(mediaId: string) {
    setBusy(true);
    try {
      await api(`/v1/events/${id}/media/${mediaId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      showToast(describeApiError(e, 'Could not remove that'));
    } finally {
      setBusy(false);
    }
  }

  async function makeCover(mediaId: string) {
    try {
      const res = await api<{ coverImageUrl: string }>(
        `/v1/events/${id}/media/${mediaId}/cover`,
        { method: 'PATCH' },
      );
      setCoverUrl(res.coverImageUrl);
      showToast('Cover updated');
    } catch (e) {
      showToast(describeApiError(e, 'Could not set the cover'));
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <KeyboardAvoidingView
      style={[styles.c, { paddingTop: insets.top + spacing[2] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.title}>Photos and video</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[5], paddingBottom: insets.bottom + spacing[10], gap: spacing[5] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.blurb}>
          Show people what your events are like. The first photo is used on cards and
          in shared links — tap any picture to make it the cover.
        </Text>

        {canPickImages() && (
          <Pressable style={styles.addBtn} disabled={busy} onPress={() => void addPhotos()}>
            {busy ? (
              <ActivityIndicator color={color.ink[0]} />
            ) : (
              <>
                <Ionicons name="images-outline" size={18} color={color.ink[0]} />
                <Text style={styles.addBtnText}>Add photos</Text>
              </>
            )}
          </Pressable>
        )}

        <View style={styles.videoRow}>
          <TextInput
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="Paste a YouTube or Vimeo link"
            placeholderTextColor={color.ink[300]}
            style={styles.videoInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={() => void addVideo()}
          />
          <Pressable
            style={[styles.videoBtn, (!videoUrl.trim() || busy) && { opacity: 0.5 }]}
            disabled={!videoUrl.trim() || busy}
            onPress={() => void addVideo()}
          >
            <Text style={styles.videoBtnText}>Add</Text>
          </Pressable>
        </View>

        {items === null ? (
          <ActivityIndicator style={{ marginTop: spacing[6] }} color={color.ink[500]} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title="No photos yet"
            message="Add pictures from a previous event so people know what to expect."
          />
        ) : (
          <View style={{ gap: spacing[3] }}>
            {items.map((m, i) => {
              const isCover = m.kind === 'IMAGE' && !!coverUrl && m.url === coverUrl;
              return (
                <View key={m.id} style={styles.row}>
                  <Pressable
                    onPress={() => m.kind === 'IMAGE' && void makeCover(m.id)}
                    style={styles.thumbWrap}
                  >
                    {m.kind === 'IMAGE' ? (
                      <Image source={{ uri: m.url }} style={styles.thumb} />
                    ) : m.thumbnailUrl ? (
                      <Image source={{ uri: m.thumbnailUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Ionicons name="videocam" size={20} color={color.ink[400]} />
                      </View>
                    )}
                    {m.kind === 'VIDEO' && (
                      <View style={styles.playBadge}>
                        <Ionicons name="play" size={12} color={color.ink[0]} />
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {m.kind === 'VIDEO' ? 'Video' : isCover ? 'Cover photo' : 'Photo'}
                    </Text>
                    <Text style={styles.rowHint} numberOfLines={1}>
                      {m.kind === 'VIDEO' ? m.url : isCover ? 'Shown on cards and links' : 'Tap to make cover'}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => void move(i, -1)}
                      disabled={i === 0}
                      hitSlop={8}
                      style={i === 0 && { opacity: 0.3 }}
                    >
                      <Ionicons name="chevron-up" size={20} color={color.ink[600]} />
                    </Pressable>
                    <Pressable
                      onPress={() => void move(i, 1)}
                      disabled={i === items.length - 1}
                      hitSlop={8}
                      style={i === items.length - 1 && { opacity: 0.3 }}
                    >
                      <Ionicons name="chevron-down" size={20} color={color.ink[600]} />
                    </Pressable>
                    <Pressable onPress={() => void remove(m.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={color.ink[600]} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink[900] },
  blurb: { fontSize: fontSize.sm, color: color.ink[500], lineHeight: 20 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: color.ink[900],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
  },
  addBtnText: { color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  videoRow: { flexDirection: 'row', gap: spacing[2] },
  videoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.sm,
    color: color.ink[900],
  },
  videoBtn: {
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink[900],
  },
  videoBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink[900] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    padding: spacing[2],
  },
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: color.ink[100] },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(10,10,10,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: color.ink[900] },
  rowHint: { fontSize: fontSize.xs, color: color.ink[500], marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingRight: spacing[2] },
});

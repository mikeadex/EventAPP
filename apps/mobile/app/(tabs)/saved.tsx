import { useCallback, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, theme, radiusExtra } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { Card, ScreenHeader } from '@/components/ui';

const BAR_CLEARANCE = 110;

interface SavedEntry {
  createdAt: string;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    coverImageUrl: string | null;
    organization: { slug: string; name: string };
  };
}

/**
 * The handoff lays these out as a landscape row — a 92px square thumbnail
 * beside the text — rather than the full-width cover the screen used before.
 * It fits roughly twice as many on screen, which is the point of a list you
 * come back to.
 */
function SavedCard({ entry }: { entry: SavedEntry }) {
  const { event } = entry;
  const d = new Date(event.startsAt);
  return (
    <Card
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/event/[id]',
          params: { id: event.id, orgSlug: event.organization.slug, eventSlug: event.slug },
        })
      }
    >
      {event.coverImageUrl ? (
        <Image source={{ uri: event.coverImageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="calendar-outline" size={26} color={theme.dark.textMuted} />
        </View>
      )}
      <View style={styles.body}>
        <Text variant="overline" tone="accent" style={styles.when}>
          {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ·{' '}
          {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text variant="subtitle" tone="onPhoto" numberOfLines={2} style={styles.title}>
          {event.title}
        </Text>
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {event.organization.name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.dark.textMuted} />
    </Card>
  );
}

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { data: session, isPending: sessionPending } = useSession();
  const [items, setItems] = useState<SavedEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setError(null);
    try {
      const d = await api<SavedEntry[]>('/v1/me/saved-events');
      setItems(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved events');
    }
  }, []);

  // Refetch every time the tab gains focus so unsaving on event-detail is
  // reflected immediately.
  useFocusEffect(
    useCallback(() => {
      if (!session?.user) {
        setItems([]);
        return;
      }
      void fetchSaved();
    }, [session?.user, fetchSaved]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSaved();
    setRefreshing(false);
  }, [fetchSaved]);

  const top = { paddingTop: insets.top };

  if (sessionPending) {
    return (
      <View style={[styles.screen, top]}>
        <LoadingState />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={[styles.screen, top]}>
        <ScreenHeader title="Saved" />
        <EmptyState
          icon="heart-outline"
          title="Sign in to save events"
          message="Tap the heart on any event to keep it here for later."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/sign-in')}
        />
      </View>
    );
  }

  const count = items?.length ?? 0;

  return (
    <View style={[styles.screen, top]}>
      <ScreenHeader
        title="Saved"
        subtitle={items === null ? undefined : count === 1 ? '1 event' : `${count} events`}
      />
      {items === null ? (
        error ? (
          <ErrorState message={error} onRetry={fetchSaved} />
        ) : (
          <View style={styles.list}>
            <ListSkeleton rows={4} height={116} />
          </View>
        )
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.event.id}
          contentContainerStyle={
            items.length === 0 ? { flexGrow: 1 } : [styles.list, { paddingBottom: BAR_CLEARANCE }]
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.dark.accent}
              colors={[theme.dark.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              message="Tap the heart on an event to keep track of it here."
              actionLabel="Find events"
              onAction={() => router.push('/')}
            />
          }
          renderItem={({ item }) => <SavedCard entry={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  list: { paddingHorizontal: spacing[5], gap: spacing[4] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
  },
  thumb: { width: 92, height: 92, borderRadius: 12, backgroundColor: theme.dark.surfaceRaised },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 7, justifyContent: 'center' },
  // 0.18em at 11px, per the handoff — slightly tighter than the 0.2em the
  // `overline` variant carries by default.
  when: { letterSpacing: 1.98 },
  title: { lineHeight: 22 },
});

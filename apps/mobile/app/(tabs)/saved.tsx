import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton, LoadingState } from '@/components/states';

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

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const topPad = { paddingTop: insets.top + spacing[2] };
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

  if (sessionPending) {
    return (
      <View style={[styles.c, topPad]}>
        <LoadingState />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={[styles.c, topPad]}>
        <Text style={styles.h}>Saved</Text>
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

  return (
    <View style={[styles.c, topPad]}>
      <Text style={styles.h}>Saved</Text>
      {items === null ? (
        error ? (
          <ErrorState message={error} onRetry={fetchSaved} />
        ) : (
          <ListSkeleton rows={3} height={120} />
        )
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.event.id}
          contentContainerStyle={
            items.length === 0
              ? { flexGrow: 1 }
              : { paddingTop: spacing[4], paddingBottom: 110 }
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.brand[600]}
              colors={[color.brand[600]]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="Nothing saved yet"
              message="Tap the heart on an event to keep track of it here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/event/[id]',
                  params: {
                    id: item.event.id,
                    orgSlug: item.event.organization.slug,
                    eventSlug: item.event.slug,
                  },
                })
              }
            >
              {item.event.coverImageUrl && (
                <Image source={{ uri: item.event.coverImageUrl }} style={styles.cover} />
              )}
              <View style={{ padding: spacing[3] }}>
                <Text style={styles.date}>
                  {new Date(item.event.startsAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.title}>{item.event.title}</Text>
                <Text style={styles.muted}>{item.event.organization.name}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[50], padding: spacing[4] },
  h: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: color.ink[900] },
  muted: { color: color.ink[400], marginTop: spacing[1] },
  card: {
    backgroundColor: color.ink[0],
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  cover: { width: '100%', height: 140, backgroundColor: color.ink[100] },
  date: {
    fontSize: fontSize.xs,
    color: color.brand[600],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: color.ink[900],
    marginTop: spacing[1],
  },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';

interface FeedItem {
  id: string;
  organization: { id: string; slug: string; name: string; logoUrl: string | null };
}

interface HostCard {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  eventCount: number;
}

export default function HostsScreen() {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const d = await api<{ items: FeedItem[] }>('/v1/events?limit=50');
      setFeed(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hosts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Roll up unique hosts (organizations — churches, ministries, communities)
  // from the upcoming-events feed. This is the cheapest "hosts with activity"
  // view until we have a dedicated /organizations search endpoint in Phase 3.
  const hosts = useMemo<HostCard[]>(() => {
    if (!feed) return [];
    const counts = new Map<string, HostCard>();
    for (const item of feed) {
      const o = item.organization;
      const existing = counts.get(o.id);
      if (existing) {
        existing.eventCount += 1;
      } else {
        counts.set(o.id, {
          id: o.id,
          slug: o.slug,
          name: o.name,
          logoUrl: o.logoUrl,
          eventCount: 1,
        });
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.eventCount - a.eventCount);
  }, [feed]);

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
      <Text style={styles.h}>Hosts</Text>
      <Text style={styles.subtitle}>Churches & organisations with upcoming events</Text>
      {loading ? (
        <ListSkeleton rows={5} height={80} />
      ) : error && hosts.length === 0 ? (
        <ErrorState message={error} onRetry={() => load('initial')} />
      ) : (
        <FlatList
          data={hosts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={
            hosts.length === 0
              ? { flexGrow: 1 }
              : { paddingTop: spacing[4], paddingBottom: 110 }
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={color.brand[600]}
              colors={[color.brand[600]]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="business-outline"
              title="No active hosts yet"
              message="Hosts appear here once they publish upcoming events."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/host/[slug]', params: { slug: item.slug } })}
            >
              <View style={styles.logo}>
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={styles.logoImg} />
                ) : (
                  <Text style={styles.logoFallback}>{item.name.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {item.eventCount} upcoming {item.eventCount === 1 ? 'event' : 'events'}
                </Text>
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
  subtitle: { color: color.ink[500], marginTop: spacing[1], fontSize: fontSize.base },
  muted: { color: color.ink[400], marginTop: spacing[1], fontSize: fontSize.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: color.ink[0],
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoFallback: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: color.brand[700],
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink[900] },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Text } from '@/components/text';
import { Card, CONTROL_BORDER, MonogramTile, ScreenHeader } from '@/components/ui';

const BAR_CLEARANCE = 110;

interface FeedItem {
  id: string;
  organization: { id: string; slug: string; name: string; logoUrl: string | null };
  venue: { city: string; country: string } | null;
}

interface HostCard {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  eventCount: number;
  city: string | null;
}

export default function HostsScreen() {
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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
  // view until we have a dedicated /organizations search endpoint.
  //
  // The city is derived the same way: the one that appears most often across
  // that host's upcoming events. Organizations carry no address of their own,
  // and a host running everything in one place — which is most of them — gets
  // the right answer. Hosts whose events are all online or have no venue show
  // no city rather than a guess.
  const hosts = useMemo<HostCard[]>(() => {
    if (!feed) return [];
    const byOrg = new Map<string, HostCard & { cities: Map<string, number> }>();
    for (const item of feed) {
      const o = item.organization;
      let entry = byOrg.get(o.id);
      if (!entry) {
        entry = {
          id: o.id,
          slug: o.slug,
          name: o.name,
          logoUrl: o.logoUrl,
          eventCount: 0,
          city: null,
          cities: new Map(),
        };
        byOrg.set(o.id, entry);
      }
      entry.eventCount += 1;
      const city = item.venue?.city;
      if (city) entry.cities.set(city, (entry.cities.get(city) ?? 0) + 1);
    }
    return Array.from(byOrg.values())
      .map((e) => {
        const top = [...e.cities.entries()].sort((a, b) => b[1] - a[1])[0];
        return { ...e, city: top?.[0] ?? null };
      })
      .sort((a, b) => b.eventCount - a.eventCount);
  }, [feed]);

  // Filtering what is already loaded — there is no host-search endpoint, and a
  // field that only narrows the visible list is honest about that.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) => h.name.toLowerCase().includes(q) || (h.city?.toLowerCase().includes(q) ?? false),
    );
  }, [hosts, query]);

  const subtitle = loading
    ? undefined
    : `${hosts.length} ${hosts.length === 1 ? 'host' : 'hosts'} with upcoming events`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Hosts" subtitle={subtitle} />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.dark.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hosts"
          placeholderTextColor={theme.dark.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.list}>
          <ListSkeleton rows={5} height={80} />
        </View>
      ) : error && hosts.length === 0 ? (
        <ErrorState message={error} onRetry={() => load('initial')} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            visible.length === 0 ? { flexGrow: 1 } : [styles.list, { paddingBottom: BAR_CLEARANCE }]
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={theme.dark.accent}
              colors={[theme.dark.accent]}
            />
          }
          ListEmptyComponent={
            query.trim() ? (
              <EmptyState
                icon="search-outline"
                title="No hosts match that"
                message={`Nothing here for “${query.trim()}”. Try a different name or city.`}
                actionLabel="Clear search"
                onAction={() => setQuery('')}
              />
            ) : (
              <EmptyState
                icon="business-outline"
                title="No active hosts yet"
                message="Hosts appear here once they publish upcoming events."
              />
            )
          }
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => router.push({ pathname: '/host/[slug]', params: { slug: item.slug } })}
            >
              {item.logoUrl ? (
                <Image source={{ uri: item.logoUrl }} style={styles.logo} />
              ) : (
                <MonogramTile letter={item.name.charAt(0)} size={52} rounded={14} />
              )}
              <View style={styles.cardBody}>
                <Text variant="subtitle" tone="onPhoto" numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.meta}>
                  {item.city ? (
                    <>
                      <Text variant="label" tone="secondary">
                        {item.city}
                      </Text>
                      <View style={styles.dot} />
                    </>
                  ) : null}
                  <Text variant="label" tone="secondary">
                    {item.eventCount} upcoming
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dark.textMuted} />
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: spacing[5],
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
  },
  searchInput: {
    flex: 1,
    color: theme.dark.textPrimary,
    fontFamily: 'Alata_400Regular',
    fontSize: 15,
  },
  list: { paddingHorizontal: spacing[5], gap: spacing[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: theme.dark.surfaceRaised },
  cardBody: { flex: 1, gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: palette.coral[400] },
});

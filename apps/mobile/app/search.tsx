import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';

interface EventItem {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  category: string;
  attendeeCount: number;
  coverImageUrl: string | null;
  isFree: boolean;
  venue: { city: string; country: string } | null;
  organization: { slug: string; name: string };
}

const ALL = 'All';

// Matches EventCategory in @ekklesia/shared (API expects lowercase values).
const CATEGORIES = [
  'service',
  'worship',
  'prayer',
  'youth',
  'kids',
  'small_group',
  'conference',
  'outreach',
  'social',
  'fundraiser',
  'class',
  'other',
];

type DateFilter = 'any' | 'today' | 'weekend' | 'month';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'month', label: 'This month' },
];

/** Translate a date-filter key into [startsAfter, startsBefore] ISO bounds. */
function dateRange(filter: DateFilter): { startsAfter: string; startsBefore?: string } {
  const now = new Date();
  const endOf = (d: Date) => {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
  };
  switch (filter) {
    case 'today':
      return { startsAfter: now.toISOString(), startsBefore: endOf(now).toISOString() };
    case 'weekend': {
      // Upcoming Saturday 00:00 → Sunday 23:59 (if already the weekend, from now).
      const day = now.getDay(); // 0 = Sun, 6 = Sat
      const start = new Date(now);
      if (day !== 0 && day !== 6) {
        start.setDate(now.getDate() + (6 - day));
        start.setHours(0, 0, 0, 0);
      }
      const sunday = new Date(start);
      sunday.setDate(start.getDate() + (start.getDay() === 0 ? 0 : 1));
      return { startsAfter: start.toISOString(), startsBefore: endOf(sunday).toISOString() };
    }
    case 'month': {
      const end = endOf(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { startsAfter: now.toISOString(), startsBefore: end.toISOString() };
    }
    default:
      return { startsAfter: now.toISOString() };
  }
}

function prettyCategory(c: string) {
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState(ALL);
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [freeOnly, setFreeOnly] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      const range = dateRange(dateFilter);
      params.set('startsAfter', range.startsAfter);
      if (range.startsBefore) params.set('startsBefore', range.startsBefore);
      if (query.trim()) params.set('q', query.trim());
      if (activeCat !== ALL) params.set('category', activeCat);
      if (freeOnly) params.set('free', 'true');
      const d = await api<{ items: EventItem[] }>(`/v1/events?${params.toString()}`);
      if (seq === requestSeq.current) setItems(d.items);
    } catch (e) {
      if (seq === requestSeq.current) {
        setError(e instanceof Error ? e.message : 'Failed to load events');
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [query, activeCat, dateFilter, freeOnly]);

  // Debounce keystrokes; filters trigger immediately (load identity changes).
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const hasActiveFilter = useMemo(
    () => Boolean(query.trim()) || activeCat !== ALL || dateFilter !== 'any' || freeOnly,
    [query, activeCat, dateFilter, freeOnly],
  );

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={color.ink[900]} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={color.ink[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search events or hosts"
            placeholderTextColor={color.ink[400]}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={color.ink[300]} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Date + free chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        <Pressable
          onPress={() => setFreeOnly((f) => !f)}
          style={[styles.chip, freeOnly && styles.chipActive]}
        >
          <Ionicons
            name={freeOnly ? 'checkmark' : 'pricetag-outline'}
            size={13}
            color={freeOnly ? color.ink[0] : color.ink[600]}
          />
          <Text style={[styles.chipText, freeOnly && styles.chipTextActive]}>Free</Text>
        </Pressable>
        <View style={styles.chipDivider} />
        {DATE_FILTERS.map(({ key, label }) => {
          const active = dateFilter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setDateFilter(active ? 'any' : key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {[ALL, ...CATEGORIES].map((cat) => {
          const active = cat === activeCat;
          return (
            <Pressable
              key={cat}
              onPress={() => setActiveCat(cat)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat === ALL ? ALL : prettyCategory(cat)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ paddingHorizontal: spacing[5] }}>
          <ListSkeleton rows={4} height={84} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[10] }}
          ListEmptyComponent={
            <EmptyState
              icon={hasActiveFilter ? 'search-outline' : 'compass-outline'}
              title={hasActiveFilter ? 'No matches' : 'Find your next event'}
              message={
                hasActiveFilter
                  ? 'Try a different search or loosen a filter.'
                  : 'Search by event name or host, or pick a filter above.'
              }
            />
          }
          renderItem={({ item }) => {
            const d = new Date(item.startsAt);
            return (
              <Link
                href={{
                  pathname: '/event/[id]',
                  params: { id: item.id, orgSlug: item.organization.slug, eventSlug: item.slug },
                }}
                asChild
              >
                <Pressable style={styles.row}>
                  <View style={styles.thumb}>
                    {item.coverImageUrl ? (
                      <Image source={{ uri: item.coverImageUrl }} style={styles.thumbImg} />
                    ) : (
                      <Ionicons name="calendar-outline" size={22} color={color.ink[300]} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowCat}>
                      {prettyCategory(item.category)}
                      {item.isFree ? '  ·  FREE' : ''}
                    </Text>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.rowMeta}>
                      <Ionicons name="calendar-outline" size={12} color={color.ink[400]} />
                      <Text style={styles.rowMetaText}>
                        {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ·{' '}
                        {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        {item.venue ? ` · ${item.venue.city}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={color.ink[300]} />
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0] },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  backBtn: { width: 36, height: 50, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: color.ink[50],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    height: 50,
  },
  input: { flex: 1, fontSize: fontSize.base, color: color.ink[900] },

  chipsScroll: { flexGrow: 0, marginBottom: spacing[3] },
  chips: { paddingHorizontal: spacing[5], gap: spacing[2], alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.ink[200],
    backgroundColor: color.ink[0],
  },
  chipActive: { backgroundColor: color.ink[900], borderColor: color.ink[900] },
  chipText: { fontSize: fontSize.sm, color: color.ink[600], fontWeight: fontWeight.medium },
  chipTextActive: { color: color.ink[0] },
  chipDivider: { width: 1, height: 20, backgroundColor: color.ink[200] },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowCat: {
    fontSize: 11,
    color: color.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.ink[900] },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[1] },
  rowMetaText: { fontSize: fontSize.xs, color: color.ink[500] },
});

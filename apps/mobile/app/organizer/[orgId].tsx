import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/states';

interface OrgEvent {
  id: string;
  slug: string;
  title: string;
  status: string;
  startsAt: string;
  capacity: number | null;
  attendeeCount: number;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrgDashboardScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<OrgEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      try {
        setEvents(await api<OrgEvent[]>(`/v1/organizations/${orgId}/events`));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load events');
      } finally {
        setRefreshing(false);
      }
    },
    [orgId],
  );

  // Re-runs on return from the edit/create screens, so a new or just-published
  // event is reflected without a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const live = events?.filter((e) => e.status === 'PUBLISHED') ?? [];
  const drafts = events?.filter((e) => e.status === 'DRAFT' || e.status === 'SCHEDULED') ?? [];
  const done = events?.filter((e) => e.status === 'COMPLETED' || e.status === 'CANCELLED') ?? [];

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.h}>Your events</Text>
        <Pressable
          onPress={() => router.push(`/organizer/event/new?orgId=${orgId}`)}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityLabel="Create event"
        >
          <Ionicons name="add" size={26} color={color.ink[900]} />
        </Pressable>
      </View>

      {error && !events ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !events ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.ink[900]} />
        </View>
      ) : events.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No events yet"
          message="Create your first event and publish it when you're ready."
          actionLabel="Create event"
          onAction={() => router.push(`/organizer/event/new?orgId=${orgId}`)}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing[5], paddingBottom: insets.bottom + spacing[8] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={color.ink[400]} />
          }
        >
          <Section title="Live" events={live} orgId={orgId!} />
          <Section title="Drafts" events={drafts} orgId={orgId!} />
          <Section title="Past" events={done} orgId={orgId!} muted />
        </ScrollView>
      )}
    </View>
  );
}

function Section({
  title,
  events,
  orgId,
  muted,
}: {
  title: string;
  events: OrgEvent[];
  orgId: string;
  muted?: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <View style={{ marginBottom: spacing[6] }}>
      <Text style={styles.sectionTitle}>
        {title} · {events.length}
      </Text>
      <View style={{ gap: spacing[3], opacity: muted ? 0.6 : 1 }}>
        {events.map((e) => (
          <Pressable
            key={e.id}
            style={styles.card}
            onPress={() => router.push(`/organizer/event/${e.id}?orgId=${orgId}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={styles.cardSub}>
                {when(e.startsAt)}
                {' · '}
                {e.attendeeCount}
                {e.capacity !== null ? `/${e.capacity}` : ''} going
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{e.status.toLowerCase()}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink[900] },
  sectionTitle: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: color.ink[400],
    marginBottom: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.ink[100],
  },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.ink[900] },
  cardSub: { fontSize: fontSize.xs, color: color.ink[500], marginTop: 2 },
  badge: {
    borderRadius: radius.full,
    backgroundColor: color.ink[100],
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: fontSize.xs,
    color: color.ink[600],
    textTransform: 'capitalize',
  },
});

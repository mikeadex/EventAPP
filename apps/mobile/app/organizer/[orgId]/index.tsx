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
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
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
  const [verification, setVerification] = useState<string | null>(null);

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
      // Verification state rides along on /v1/me; a failure here just leaves the
      // banner hidden rather than blocking the events list.
      try {
        const me = await api<{ memberships?: { organizationId: string; verificationStatus?: string }[] }>(
          '/v1/me',
        );
        const mine = me.memberships?.find((m) => m.organizationId === orgId);
        setVerification(mine?.verificationStatus ?? null);
      } catch {
        /* leave as-is */
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
          <Ionicons name="chevron-back" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text style={styles.h}>Your events</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push(`/organizer/${orgId}/edit`)}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityLabel="Edit your organisation"
          >
            <Ionicons name="business-outline" size={21} color={theme.dark.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/organizer/event/new?orgId=${orgId}`)}
            hitSlop={8}
            style={styles.backBtn}
            accessibilityLabel="Create event"
          >
            <Ionicons name="add" size={26} color={theme.dark.textPrimary} />
          </Pressable>
        </View>
      </View>

      {error && !events ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !events ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.dark.textPrimary} />
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
            <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={theme.dark.textMuted} />
          }
        >
          {verification === 'PENDING' || verification === 'UNVERIFIED' ? (
            /* UNVERIFIED is a prompt, so it goes somewhere — it used to name a
               task with no way to start it. PENDING is purely informational
               (the review is ours to do), so it stays a plain notice. */
            verification === 'UNVERIFIED' ? (
              <Pressable
                style={({ pressed }) => [styles.verifyBanner, styles.verifyAction, pressed && { opacity: 0.8 }]}
                onPress={() => router.push(`/organizer/${orgId}/edit`)}
              >
                <Ionicons name="shield-outline" size={18} color={theme.dark.accent} />
                <Text style={[styles.verifyText, styles.verifyActionText]}>
                  Add your contact and address details to get verified.
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.dark.accent} />
              </Pressable>
            ) : (
              <View style={styles.verifyBanner}>
                <Ionicons name="shield-outline" size={18} color={theme.dark.textSecondary} />
                <Text style={styles.verifyText}>
                  We’re reviewing your host details. You can publish events in the meantime.
                </Text>
              </View>
            )
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.payoutsRow, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/organizer/${orgId}/payouts`)}
          >
            <Ionicons name="card-outline" size={20} color={theme.dark.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutsLabel}>Payouts</Text>
              <Text style={styles.payoutsSub}>How you get paid for ticket sales</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.dark.textMuted} />
          </Pressable>

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
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  h: { fontSize: fontSize.lg, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: 14,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.14)',
    marginBottom: spacing[5],
  },
  // The actionable one carries the refresh's "this wants you" treatment. On
  // the plain surface it read as disabled, which is the wrong signal for the
  // one step standing between a host and being verified.
  verifyAction: {
    backgroundColor: 'rgba(249,142,128,0.09)',
    borderColor: 'rgba(249,142,128,0.42)',
  },
  verifyText: { flex: 1, fontSize: fontSize.sm, color: theme.dark.textSecondary, lineHeight: 21 },
  verifyActionText: { color: palette.coral[200] },
  payoutsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: 14,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.14)',
    marginBottom: spacing[5],
  },
  payoutsLabel: { fontSize: fontSize.base, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  payoutsSub: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.dark.textMuted,
    marginBottom: spacing[3],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.dark.borderSubtle,
  },
  cardTitle: { fontSize: fontSize.base, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  cardSub: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  badge: {
    borderRadius: radius.full,
    backgroundColor: theme.dark.surfaceRaised,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: fontSize.xs,
    color: theme.dark.textSecondary,
    textTransform: 'capitalize',
  },
});

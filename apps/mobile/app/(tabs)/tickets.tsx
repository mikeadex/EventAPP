import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, theme, palette } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton, LoadingState } from '@/components/states';
import { Text } from '@/components/text';
import { Card, ScreenHeader } from '@/components/ui';
import { Divider, Gradient, scrimPreset } from '@/components/gradient';

const BAR_CLEARANCE = 110;

interface Ticket {
  id: string;
  code: string;
  status: string;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    coverImageUrl: string | null;
    organization: { slug: string; name: string };
  };
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const { event } = ticket;
  const d = new Date(event.startsAt);
  return (
    <Card onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: ticket.id } })}>
      <View style={styles.cover}>
        {event.coverImageUrl ? (
          <Image source={{ uri: event.coverImageUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
            <Ionicons name="ticket-outline" size={30} color={theme.dark.textMuted} />
          </View>
        )}
        {/* Fades into the card's own surface, not to black, so the cover and
            the body below it read as one piece. */}
        <Gradient stops={scrimPreset.ticketCover} />
      </View>
      <View style={styles.body}>
        <Text variant="overline" tone="accent">
          {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at{' '}
          {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text variant="title" tone="onPhoto" numberOfLines={2}>
          {event.title}
        </Text>
        <Text variant="footnote" tone="secondary" numberOfLines={1}>
          {event.organization.name}
        </Text>
        <Divider inset={0.12} style={styles.rule} />
        <View style={styles.footer}>
          {/* The ticket code is the one place mono earns its keep on this
              screen — 0.06em at 13px, per the handoff. */}
          <Text variant="mono" style={styles.code}>
            {ticket.code}
          </Text>
          <Text variant="footnote" tone="accent">
            View QR →
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const { data: session, isPending: sessionPending } = useSession();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const data = await api<Ticket[]>('/v1/me/tickets');
      setTickets(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    void load('initial');
  }, [session?.user, load]);

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
        <ScreenHeader title="Your tickets" />
        <EmptyState
          icon="ticket-outline"
          title="Sign in to view your tickets"
          message="Your RSVPs and QR codes live here once you're signed in."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/sign-in')}
        />
      </View>
    );
  }

  const count = tickets?.length ?? 0;

  return (
    <View style={[styles.screen, top]}>
      <ScreenHeader
        title="Your tickets"
        subtitle={tickets === null ? undefined : count === 1 ? '1 ticket' : `${count} tickets`}
      />
      {tickets === null ? (
        error ? (
          <ErrorState message={error} onRetry={() => load('initial')} />
        ) : (
          <View style={styles.list}>
            <ListSkeleton rows={2} height={230} />
          </View>
        )
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={
            tickets.length === 0 ? { flexGrow: 1 } : [styles.list, { paddingBottom: BAR_CLEARANCE }]
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
            <EmptyState
              icon="ticket-outline"
              title="No RSVPs yet"
              message="When you RSVP to an event, your ticket shows up here."
              actionLabel="Find events"
              onAction={() => router.push('/')}
            />
          }
          renderItem={({ item }) => <TicketCard ticket={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  list: { paddingHorizontal: spacing[5], gap: spacing[4] },
  cover: { height: 132, backgroundColor: theme.dark.surfaceRaised },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingVertical: 15, gap: spacing[2] },
  rule: { marginTop: 6, marginBottom: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { color: palette.warm[300], letterSpacing: 0.78 },
});

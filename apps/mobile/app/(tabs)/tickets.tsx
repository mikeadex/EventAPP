import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { EmptyState, ErrorState, ListSkeleton, LoadingState } from '@/components/states';

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

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = { paddingTop: insets.top + spacing[2] };
  const { data: session, isPending: sessionPending } = useSession();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
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
    },
    [],
  );

  useEffect(() => {
    if (!session?.user) return;
    void load('initial');
  }, [session?.user, load]);

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
        <Text style={styles.h}>Your tickets</Text>
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

  return (
    <View style={[styles.c, topPad]}>
      <Text style={styles.h}>Your tickets</Text>
      {tickets === null ? (
        error ? (
          <ErrorState message={error} onRetry={() => load('initial')} />
        ) : (
          <ListSkeleton rows={3} height={120} />
        )
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={
            tickets.length === 0
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
              icon="ticket-outline"
              title="No RSVPs yet"
              message="When you RSVP to an event, your ticket shows up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/tickets/[id]', params: { id: item.id } })
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
                <Text style={styles.code}>{item.code}</Text>
                <Text style={styles.cta}>Tap to view QR →</Text>
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
  code: {
    fontFamily: 'Courier',
    marginTop: spacing[2],
    color: color.ink[700],
    fontSize: fontSize.sm,
  },
  cta: {
    marginTop: spacing[2],
    color: color.brand[600],
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});

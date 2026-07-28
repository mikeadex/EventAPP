import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';

interface Org {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  country: string;
  verificationStatus: string;
}

interface EventItem {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  coverImageUrl: string | null;
  organization: { slug: string; name: string };
}

export default function HostScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [org, setOrg] = useState<Org | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api<Org>(`/v1/organizations/${slug}`)
      .then(async (o) => {
        setOrg(o);
        const feed = await api<{ items: EventItem[] }>('/v1/events?limit=50');
        setEvents(feed.items.filter((e) => e.organization.slug === slug));
      })
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <View style={[styles.c, styles.center]}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!org) {
    return (
      <View style={[styles.c, styles.center]}>
        <ActivityIndicator color={color.brand[600]} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: org.name }} />
      <View style={styles.c}>
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={
            <View style={{ paddingBottom: spacing[6] }}>
              <View style={styles.heroRow}>
                <View style={styles.logo}>
                  {org.logoUrl ? (
                    <Image source={{ uri: org.logoUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={styles.logoFallback}>{org.name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h}>{org.name}</Text>
                  {org.shortDescription && (
                    <Text style={styles.muted}>{org.shortDescription}</Text>
                  )}
                </View>
              </View>
              {org.description && <Text style={styles.body}>{org.description}</Text>}
              <Text style={[styles.sectionLabel, { marginTop: spacing[6] }]}>
                Upcoming events
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.muted}>No upcoming events.</Text>
          }
          contentContainerStyle={{ padding: spacing[4] }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/event/[id]',
                  params: { id: item.id, orgSlug: item.organization.slug, eventSlug: item.slug },
                })
              }
            >
              {item.coverImageUrl && (
                <Image source={{ uri: item.coverImageUrl }} style={styles.cover} />
              )}
              <View style={{ padding: spacing[3] }}>
                <Text style={styles.date}>
                  {new Date(item.startsAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[50] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: color.danger },
  heroRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoFallback: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: color.brand[700],
  },
  h: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: color.ink[900] },
  muted: { color: color.ink[500], marginTop: spacing[1], fontSize: fontSize.sm },
  body: { color: color.ink[700], marginTop: spacing[4], fontSize: fontSize.base, lineHeight: 22 },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: color.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: color.ink[0],
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  cover: { width: '100%', height: 140, backgroundColor: color.ink[100] },
  date: {
    fontSize: fontSize.xs,
    color: color.brand[600],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: color.ink[900],
    marginTop: spacing[1],
  },
});

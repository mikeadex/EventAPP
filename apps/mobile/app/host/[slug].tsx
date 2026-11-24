import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text } from '@/components/text';
import { CARD_BORDER, CONTROL_BORDER, MonogramTile } from '@/components/ui';
import { api, describeApiError } from '@/lib/api';
import { ReportSheet } from '@/components/report-sheet';
import { showToast } from '@/components/toast';

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
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [reporting, setReporting] = useState(false);
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
        <Text variant="body" style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!org) {
    return (
      <View style={[styles.c, styles.center]}>
        <ActivityIndicator color={theme.dark.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: org.name }} />
      <View style={[styles.c, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.roundBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
          </Pressable>
        </View>
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={
            <View style={{ paddingBottom: spacing[6] }}>
              <View style={styles.heroRow}>
                {org.logoUrl ? (
                  <Image source={{ uri: org.logoUrl }} style={styles.logo} />
                ) : (
                  <MonogramTile letter={org.name.charAt(0)} size={76} rounded={20} />
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="title" tone="onPhoto" style={styles.h}>{org.name}</Text>
                  {org.shortDescription && (
                    <Text variant="label" tone="secondary" style={styles.muted}>{org.shortDescription}</Text>
                  )}
                </View>
              </View>
              {org.description && (
                <Text variant="body" style={styles.body}>{org.description}</Text>
              )}

              <View style={styles.safetyRow}>
                <Pressable style={styles.safetyBtn} onPress={() => setReporting(true)}>
                  <Ionicons name="flag-outline" size={16} color={theme.dark.textSecondary} />
                  <Text variant="caption" tone="secondary">Report</Text>
                </Pressable>
                <Pressable
                  style={styles.safetyBtn}
                  onPress={() => {
                    // Confirmed, because it changes what they see and they may
                    // have meant to tap Report.
                    Alert.alert(
                      `Block ${org.name}?`,
                      "You won't see their events. They aren't told, and you can undo this in Settings.",
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Block',
                          style: 'destructive',
                          onPress: () => {
                            void api('/v1/me/blocks', {
                              method: 'POST',
                              body: { organizationId: org.id },
                            })
                              .then(() => {
                                showToast(`Blocked ${org.name}`);
                                router.back();
                              })
                              .catch((e) =>
                                showToast(describeApiError(e, 'Could not block that host')),
                              );
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="ban-outline" size={16} color={theme.dark.textSecondary} />
                  <Text variant="caption" tone="secondary">Block</Text>
                </Pressable>
              </View>

              <Text variant="monoLabel" style={[styles.sectionLabel, { marginTop: spacing[6] }]}>
                Upcoming events
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text variant="body" tone="secondary">No upcoming events.</Text>
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
                <Text variant="overline" tone="accent" style={styles.date}>
                  {new Date(item.startsAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Text variant="subtitle" tone="onPhoto" style={styles.cardTitle}>{item.title}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        target={{ organizationId: org.id }}
        what="this host"
      />
    </>
  );
}

const styles = StyleSheet.create({
  safetyRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  safetyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 9,
  },
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  topBar: { paddingHorizontal: spacing[5], paddingTop: 18, paddingBottom: spacing[2] },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: palette.coral[300] },
  heroRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: theme.dark.surfaceRaised,
  },
  h: { lineHeight: 26 },
  muted: { marginTop: spacing[1] },
  body: { color: palette.warm[400], marginTop: spacing[4], lineHeight: 24 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.98, color: palette.warm[550] },
  card: {
    backgroundColor: theme.dark.surface,
    borderRadius: radiusExtra.sheet,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  cover: { width: '100%', height: 132, backgroundColor: theme.dark.surfaceRaised },
  date: { marginBottom: 4 },
  cardTitle: { marginTop: spacing[1] },
});

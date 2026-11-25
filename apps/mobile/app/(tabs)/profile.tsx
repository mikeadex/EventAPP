import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { signOut, useSession } from '@/lib/auth-client';
import { unregisterFromPush } from '@/lib/push';
import { api } from '@/lib/api';
import { Text } from '@/components/text';
import { Card, ChevronRow, MonogramTile, ScreenHeader } from '@/components/ui';
import { Divider } from '@/components/gradient';
import { EmptyState } from '@/components/states';

const BAR_CLEARANCE = 110;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: session, isPending } = useSession();
  const [isHost, setIsHost] = useState(false);
  const signedInUserId = session?.user?.id;

  // Above the early returns: this screen returns early while the session
  // loads, and a hook called after that point would run on some renders and
  // not others. The organiser entry only appears for people who host
  // something, so it stays invisible to ordinary attendees.
  useEffect(() => {
    if (!signedInUserId) {
      setIsHost(false);
      return;
    }
    let cancelled = false;
    api<{ memberships?: unknown[] }>('/v1/me')
      .then((me) => {
        if (!cancelled) setIsHost((me.memberships?.length ?? 0) > 0);
      })
      .catch(() => {
        /* not fatal — the row simply stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [signedInUserId]);

  const top = { paddingTop: insets.top };

  if (isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={theme.dark.accent} />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={[styles.screen, top]}>
        <ScreenHeader title="Profile" />
        <EmptyState
          icon="person-outline"
          title="You're not signed in"
          message="Sign in to RSVP, save events and view your tickets."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/sign-in')}
        />
      </View>
    );
  }

  const name = session.user.name ?? 'Member';
  const initial = (session.user.name ?? session.user.email ?? '?').charAt(0);

  async function doSignOut() {
    // First, while the session is still valid — the call is authenticated.
    // Otherwise this phone keeps receiving the previous account's
    // notifications, which is a privacy problem rather than an annoyance.
    await unregisterFromPush();
    await signOut();
    router.replace('/(tabs)');
  }

  return (
    <ScrollView
      style={[styles.screen, top]}
      contentContainerStyle={{ paddingBottom: BAR_CLEARANCE }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Profile" style={styles.header} />

      <View style={styles.identity}>
        {session.user.image ? (
          <Image source={{ uri: session.user.image }} style={styles.avatar} />
        ) : (
          <MonogramTile letter={initial} size={72} rounded={36} />
        )}
        <View style={styles.identityText}>
          <Text variant="title" tone="onPhoto" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {session.user.email}
          </Text>
        </View>
      </View>

      <View style={styles.menus}>
        {/* Hosts get their console; everyone else gets the way in to becoming
            one. Always the organiser screen, never the setup screen directly:
            that decision used to come from a flag defaulting to "not a host",
            so a tap before /v1/me answered (or a request that quietly failed)
            sent an existing host off to create a second one. */}
        <ChevronRow
          accent
          icon="calendar-outline"
          label={isHost ? 'Manage your events' : 'Host events'}
          sublabel="Publish, sell tickets, check people in"
          onPress={() => router.push('/organizer')}
        />

        <Card>
          <ChevronRow
            icon="ticket-outline"
            label="Your tickets"
            onPress={() => router.push('/tickets')}
          />
          <Divider inset={0.08} opacity={0.18} style={styles.rule} />
          <ChevronRow
            icon="heart-outline"
            label="Saved events"
            onPress={() => router.push('/saved')}
          />
          <Divider inset={0.08} opacity={0.18} style={styles.rule} />
          <ChevronRow
            icon="receipt-outline"
            label="Purchases"
            onPress={() => router.push('/purchases')}
          />
          <Divider inset={0.08} opacity={0.18} style={styles.rule} />
          <ChevronRow
            icon="business-outline"
            label="Browse hosts"
            onPress={() => router.push('/hosts')}
          />
          <Divider inset={0.08} opacity={0.18} style={styles.rule} />
          <ChevronRow
            icon="settings-outline"
            label="Settings"
            onPress={() => router.push('/settings')}
          />
        </Card>

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}
          onPress={doSignOut}
        >
          <Ionicons name="log-out-outline" size={18} color={palette.warm[400]} />
          <Text variant="body" style={{ color: palette.warm[400] }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: 0 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: spacing[5],
    paddingTop: 30,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.dark.surfaceRaised },
  identityText: { flex: 1, gap: 5 },
  menus: { paddingHorizontal: spacing[5], paddingTop: 28, gap: spacing[4] },
  rule: { marginHorizontal: 18 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
  },
});

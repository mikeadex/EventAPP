import { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { signOut, useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={color.ink[900]} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={color.ink[300]} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topPad = { paddingTop: insets.top + spacing[2] };
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

  if (isPending) {
    return (
      <View style={[styles.c, styles.center]}>
        <ActivityIndicator color={color.ink[900]} />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={[styles.c, topPad]}>
        <Text style={styles.h}>Profile</Text>
        <View style={styles.signedOut}>
          <View style={styles.avatarLg}>
            <Ionicons name="person" size={36} color={color.ink[400]} />
          </View>
          <Text style={styles.signedOutText}>Sign in to RSVP, save events and view your tickets.</Text>
          <Pressable style={styles.btn} onPress={() => router.push('/auth/sign-in')}>
            <Text style={styles.btnText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const name = session.user.name ?? 'Member';
  const initial = (session.user.name ?? session.user.email ?? '?').charAt(0).toUpperCase();

  async function doSignOut() {
    await signOut();
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.c, topPad]}>
      <Text style={styles.h}>Profile</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatarLg}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{session.user.email}</Text>
      </View>

      {/* Hosts get their console; everyone else gets the way in to becoming one. */}
      <View style={[styles.menu, { marginBottom: spacing[4] }]}>
        <MenuRow
          icon="calendar-outline"
          label={isHost ? 'Manage your events' : 'Host events'}
          onPress={() => router.push(isHost ? '/organizer' : '/organizer/new-church')}
        />
      </View>

      <View style={styles.menu}>
        <MenuRow icon="ticket-outline" label="Your tickets" onPress={() => router.push('/tickets')} />
        <View style={styles.divider} />
        <MenuRow icon="heart-outline" label="Saved events" onPress={() => router.push('/saved')} />
        <View style={styles.divider} />
        <MenuRow icon="business-outline" label="Browse hosts" onPress={() => router.push('/hosts')} />
        <View style={styles.divider} />
        <MenuRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <Pressable style={styles.signOut} onPress={doSignOut}>
        <Ionicons name="log-out-outline" size={18} color={color.ink[700]} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0], padding: spacing[4] },
  center: { justifyContent: 'center', alignItems: 'center' },
  h: { fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, color: color.ink[900], letterSpacing: -0.5 },

  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    marginTop: spacing[4],
  },
  avatarLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize['4xl'], fontWeight: fontWeight.bold, color: color.ink[900] },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink[900], marginTop: spacing[3] },
  email: { fontSize: fontSize.sm, color: color.ink[500], marginTop: spacing[1] },

  menu: {
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: fontSize.base, color: color.ink[900], fontWeight: fontWeight.medium },
  divider: { height: 1, backgroundColor: color.ink[100], marginLeft: spacing[4] + 36 + spacing[3] },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink[200],
  },
  signOutText: { fontSize: fontSize.base, color: color.ink[700], fontWeight: fontWeight.semibold },

  signedOut: { alignItems: 'center', marginTop: spacing[10], gap: spacing[4] },
  signedOutText: {
    fontSize: fontSize.base,
    color: color.ink[500],
    textAlign: 'center',
    maxWidth: 280,
  },
  btn: {
    backgroundColor: color.ink[900],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
    borderRadius: radius.md,
  },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
});

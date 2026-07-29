import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { useSession, clearStoredToken } from '@/lib/auth-client';
import { api, ApiError } from '@/lib/api';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

function SettingsRow({
  icon,
  label,
  detail,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={color.ink[900]} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={color.ink[300]} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const [deleting, setDeleting] = useState(false);

  async function performDelete() {
    setDeleting(true);
    try {
      await api('/v1/me', { method: 'DELETE' });
      // Session is gone server-side; drop the local token and reset to the
      // signed-out root rather than leaving a dead session in memory.
      clearStoredToken();
      router.replace('/(tabs)');
    } catch (e) {
      // The API refuses to strand an organisation with no owner.
      if (e instanceof ApiError && e.status === 409) {
        const payload = e.payload as { organizations?: { name: string }[] } | null;
        const names = payload?.organizations?.map((o) => o.name).join(', ');
        Alert.alert(
          'Transfer ownership first',
          `You're the only owner of ${names ?? 'an organisation'}. Transfer ownership to someone else, or delete the organisation, then try again.`,
        );
      } else {
        Alert.alert(
          'Could not delete account',
          e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        );
      }
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, saved events and profile. Tickets you already hold will be released. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
      ],
    );
  }

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.h}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      {session?.user ? (
        <>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.menu}>
            <SettingsRow
              icon="person-outline"
              label="Edit profile"
              onPress={() => router.push('/settings/edit-profile')}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="lock-closed-outline"
              label="Change password"
              onPress={() => router.push('/settings/change-password')}
            />
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.menu}>
        {/* Only offered when a public web address is configured — without one
            these would build a relative "/privacy" and fail to open. */}
        {WEB_URL ? (
          <>
            <SettingsRow
              icon="shield-checkmark-outline"
              label="Privacy policy"
              onPress={() => void Linking.openURL(`${WEB_URL}/privacy`)}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon="document-text-outline"
              label="Terms of service"
              onPress={() => void Linking.openURL(`${WEB_URL}/terms`)}
            />
            <View style={styles.divider} />
          </>
        ) : null}
        <SettingsRow icon="information-circle-outline" label="Version" detail={version} />
      </View>

      {/* Apple guideline 5.1.1(v): account creation requires in-app deletion. */}
      {session?.user ? (
        <>
          <Text style={styles.sectionLabel}>Danger zone</Text>
          <View style={[styles.menu, styles.menuDanger]}>
            {deleting ? (
              <View style={styles.row}>
                <ActivityIndicator color={color.danger} />
                <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Deleting account…</Text>
              </View>
            ) : (
              <SettingsRow
                icon="trash-outline"
                label="Delete account"
                onPress={confirmDelete}
                danger
              />
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0], paddingHorizontal: spacing[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  h: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.ink[900] },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: color.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing[5],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
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
  rowLabelDanger: { color: color.danger },
  menuDanger: { borderColor: color.danger },
  rowDetail: { fontSize: fontSize.sm, color: color.ink[400] },
  divider: { height: 1, backgroundColor: color.ink[100], marginLeft: spacing[4] + 36 + spacing[3] },
});

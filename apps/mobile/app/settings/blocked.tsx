import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/states';
import { showToast } from '@/components/toast';

interface Blocked {
  id: string;
  kind: 'user' | 'organization';
  targetId: string;
  name: string;
  createdAt: string;
}

/**
 * Everything you have blocked, and the way back.
 *
 * Blocking without an undo is a trap — someone who blocks a host by mistake, or
 * changes their mind a year later, should not have to contact support. This
 * screen is the only place that undo lives, which is why it is reachable from
 * Settings rather than buried.
 */
export default function BlockedScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Blocked[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<Blocked[]>('/v1/me/blocks'));
      setError(null);
    } catch (e) {
      setError(describeApiError(e, 'Could not load your blocked list'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unblock(id: string, name: string) {
    setBusy(id);
    try {
      await api(`/v1/me/blocks/${id}`, { method: 'DELETE' });
      setItems((prev) => prev?.filter((b) => b.id !== id) ?? null);
      showToast(`Unblocked ${name}`);
    } catch (e) {
      showToast(describeApiError(e, 'Could not unblock'));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Blocked</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[5], gap: spacing[3] }}>
        {items === null ? (
          <ActivityIndicator color={theme.dark.textSecondary} style={{ marginTop: spacing[8] }} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="ban-outline"
            title="Nothing blocked"
            message="Hosts and people you block won't appear in your feed. You can block a host from their page."
          />
        ) : (
          items.map((b) => (
            <View key={b.id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={styles.kind}>
                  {b.kind === 'organization' ? 'Host' : 'Person'}
                </Text>
              </View>
              <Pressable
                style={[styles.unblock, busy === b.id && { opacity: 0.5 }]}
                disabled={busy === b.id}
                onPress={() => void unblock(b.id, b.name)}
              >
                <Text style={styles.unblockText}>
                  {busy === b.id ? '…' : 'Unblock'}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  title: { fontSize: fontSize.lg, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    padding: spacing[4],
  },
  name: { fontSize: fontSize.base, color: theme.dark.textPrimary },
  kind: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  unblock: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  unblockText: { fontSize: fontSize.sm, color: theme.dark.textPrimary },
});

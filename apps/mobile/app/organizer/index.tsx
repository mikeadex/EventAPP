import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';
import { EmptyState, ErrorState } from '@/components/states';

interface Membership {
  organizationId: string;
  slug: string;
  name: string;
  role: string;
}

export default function OrganizerHomeScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ memberships: Membership[] }>('/v1/me')
      .then((me) => {
        if (cancelled) return;
        const orgs = me.memberships ?? [];
        // Most hosts belong to exactly one church; skip the picker for them.
        if (orgs.length === 1) {
          router.replace(`/organizer/${orgs[0].organizationId}`);
          return;
        }
        setItems(orgs);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.h}>Manage</Text>
        <View style={styles.backBtn} />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={() => router.replace('/organizer')} />
      ) : !items ? (
        <View style={styles.center}>
          <ActivityIndicator color={color.ink[900]} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No churches yet"
          message="You're not part of a church that hosts events. Create one on the web to get started."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing[5], gap: spacing[3] }}>
          {items.map((m) => (
            <Pressable
              key={m.organizationId}
              style={styles.card}
              onPress={() => router.push(`/organizer/${m.organizationId}`)}
            >
              <View style={styles.cardIcon}>
                <Ionicons name="business" size={18} color={color.ink[900]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.name}</Text>
                <Text style={styles.cardSub}>{m.role.toLowerCase().replace('_', ' ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={color.ink[300]} />
            </Pressable>
          ))}
        </ScrollView>
      )}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.ink[100],
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.ink[900] },
  cardSub: { fontSize: fontSize.xs, color: color.ink[500], marginTop: 2, textTransform: 'capitalize' },
});

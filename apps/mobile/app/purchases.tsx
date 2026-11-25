import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { spacing, theme, palette } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { describeApiError } from '@/lib/api';
import { formatMoney, listOrders, type OrderSummary } from '@/lib/payments';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { Text } from '@/components/text';
import { Card } from '@/components/ui';
import { Divider } from '@/components/gradient';

/**
 * What the buyer has paid for.
 *
 * Separate from Tickets on purpose. A ticket is the thing you show at the
 * door and it belongs to one person; an order is what left your account, and
 * one order can carry several tickets. They answer different questions —
 * "what am I going to" versus "what did I pay" — and the second one is the
 * one people ask when they are checking a bank statement.
 */

function money(order: OrderSummary) {
  return formatMoney(order.totalMinor, order.currency);
}

function OrderRow({ order }: { order: OrderSummary }) {
  const bought = new Date(order.createdAt);
  const refunded = order.refundState !== 'none';

  return (
    <Card
      style={styles.card}
      onPress={() => router.push({ pathname: '/checkout/success', params: { orderId: order.id } })}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowText}>
          <Text variant="bodyLg" tone="onPhoto" numberOfLines={2}>
            {order.event.title}
          </Text>
          <Text variant="label" tone="secondary">
            {bought.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.amountCol}>
          {/* Struck through when the money came back, so the figure on screen
              can never be mistaken for what they are currently out of
              pocket. */}
          <Text
            variant="mono"
            tone={refunded ? 'muted' : 'onPhoto'}
            style={[styles.amount, order.refundState === 'full' && styles.struck]}
          >
            {money(order)}
          </Text>
          <Text variant="caption" tone="muted">
            {order.ticketCount} {order.ticketCount === 1 ? 'ticket' : 'tickets'}
          </Text>
        </View>
      </View>

      {refunded ? (
        <>
          <Divider inset={0.05} opacity={0.16} style={styles.rule} />
          <View style={styles.refundRow}>
            <Ionicons name="arrow-undo-outline" size={14} color={palette.coral[300]} />
            <Text variant="caption" style={styles.refundText}>
              {order.refundState === 'full'
                ? 'Refunded in full'
                : `${formatMoney(order.refundedMinor, order.currency)} refunded`}
            </Text>
          </View>
        </>
      ) : null}
    </Card>
  );
}

export default function PurchasesScreen() {
  const insets = useSafeAreaInsets();
  const { data: session, isPending: sessionPending } = useSession();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      setOrders(await listOrders());
    } catch (err) {
      setError(describeApiError(err, 'Could not load your purchases'));
    }
  }, [session]);

  // Refetched on focus rather than once on mount: coming back from a
  // checkout that just completed should not show a list without it in.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const body = () => {
    if (!sessionPending && !session) {
      return (
        <EmptyState
          icon="receipt-outline"
          title="You're not signed in"
          message="Sign in to see what you've paid for."
          actionLabel="Sign in"
          onAction={() => router.push('/auth/sign-in')}
        />
      );
    }
    if (error) return <ErrorState message={error} onRetry={load} />;
    if (orders === null) return <ListSkeleton />;
    if (orders.length === 0) {
      return (
        <EmptyState
          icon="receipt-outline"
          title="Nothing bought yet"
          message="Paid tickets show up here. Most events are free — those appear under Your tickets."
          actionLabel="Find something"
          onAction={() => router.push('/(tabs)')}
        />
      );
    }
    return (
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => <OrderRow order={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing[8] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.dark.accent}
          />
        }
      />
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="heading" tone="onPhoto">
          Purchases
        </Text>
        <View style={styles.backBtn} />
      </View>
      {body()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  list: { paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[3] },
  card: { padding: spacing[4], gap: spacing[2] },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  rowText: { flex: 1, gap: 4 },
  amountCol: { alignItems: 'flex-end', gap: 4 },
  amount: { letterSpacing: 0.6 },
  struck: { textDecorationLine: 'line-through' },
  rule: { marginTop: spacing[1] },
  refundRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  refundText: { color: palette.coral[300] },
});

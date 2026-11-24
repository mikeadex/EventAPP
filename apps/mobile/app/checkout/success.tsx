import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { describeApiError } from '@/lib/api';
import { formatMoney, getOrder, syncOrder, type OrderDetail } from '@/lib/payments';
import { Text } from '@/components/text';
import { ErrorState } from '@/components/states';
import { Gradient } from '@/components/gradient';
import { CARD_BORDER } from '@/components/ui';

/**
 * Screen 24 — the confirmation.
 *
 * Arrived at only after the server has said PAID, so this screen never has to
 * decide whether the money arrived. It can still land a moment before the
 * tickets themselves exist if the webhook is mid-flight, so it retries the
 * reconcile a few times rather than claiming the tickets are missing.
 */
export default function PaymentSuccessScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError(null);
    try {
      let o = await getOrder(orderId);
      // Up to three nudges, a second apart. The usual case resolves on the
      // first; this covers a webhook that is still in flight.
      for (let i = 0; i < 3 && o.status !== 'PAID'; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        await syncOrder(orderId).catch(() => undefined);
        o = await getOrder(orderId);
      }
      setOrder(o);
    } catch (err) {
      setError(describeApiError(err, 'Could not load your order'));
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !order) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={theme.dark.accent} />
      </View>
    );
  }

  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const when = new Date(order.event.startsAt).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const tiers = order.items.map((i) => `${i.quantity} × ${i.ticketType.name}`).join(', ');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.mark}>
          <Gradient
            angle={150}
            stops={[
              { at: 0, opacity: 1, color: '#2A1F21' },
              { at: 1, opacity: 1, color: '#150F11' },
            ]}
            style={{ borderRadius: 28 }}
          />
          <Ionicons name="checkmark" size={44} color={theme.dark.accent} />
        </View>

        <View style={styles.headline}>
          <Text variant="display" tone="onPhoto" style={{ textAlign: 'center' }}>
            You&apos;re going
          </Text>
          <Text variant="bodyLg" tone="secondary" style={styles.blurb}>
            {count === 1 ? 'One ticket' : `${count} tickets`} to {order.event.title}.
            {order.status === 'PAID' ? ' We’ve emailed your receipt.' : ''}
          </Text>
        </View>

        {/* The stub. A dashed rule stands in for the tear-off, as in the design. */}
        <View style={styles.stub}>
          <Gradient
            angle={168}
            stops={[
              { at: 0, opacity: 1, color: '#221A1C' },
              { at: 0.62, opacity: 1, color: '#150F11' },
            ]}
            style={{ borderRadius: 20 }}
          />
          <View style={styles.stubTop}>
            <View style={styles.stubHead}>
              <Text variant="monoLabel" tone="accent" style={{ fontSize: 10, letterSpacing: 2.2 }}>
                {when}
              </Text>
              <Text variant="subtitle" tone="onPhoto" numberOfLines={2}>
                {order.event.title}
              </Text>
            </View>
            <Ionicons name="qr-code-outline" size={26} color={theme.dark.accent} />
          </View>

          <View style={styles.perforation}>
            {Array.from({ length: 28 }).map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>

          <View style={styles.stubBottom}>
            <View style={{ gap: 4 }}>
              <Text variant="monoLabel" style={{ color: palette.warm[550] }}>
                Tickets
              </Text>
              <Text variant="body">{tiers}</Text>
            </View>
            <View style={{ gap: 4, alignItems: 'flex-end' }}>
              <Text variant="monoLabel" style={{ color: palette.warm[550] }}>
                Paid
              </Text>
              <Text variant="mono" style={styles.paid}>
                {formatMoney(order.totalMinor, order.currency)}
              </Text>
            </View>
          </View>
        </View>

        {order.status !== 'PAID' ? (
          <View style={styles.pending}>
            <Ionicons name="time-outline" size={16} color={theme.dark.accent} />
            <Text variant="label" tone="secondary" style={{ flex: 1 }}>
              Your payment went through and we are finishing up. Your tickets will appear in a
              moment.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[5] }]}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}
          onPress={() => router.replace('/(tabs)/tickets')}
        >
          <Ionicons name="ticket-outline" size={18} color={theme.dark.accent} />
          <Text variant="bodyLg" tone="accent">
            View your tickets
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text variant="body" tone="secondary">
            Back to Discover
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing[5], paddingTop: 60, gap: 22, alignItems: 'center' },
  mark: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.4)',
    overflow: 'hidden',
  },
  headline: { alignItems: 'center', gap: 12 },
  blurb: { textAlign: 'center', lineHeight: 25 },
  stub: {
    alignSelf: 'stretch',
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.18)',
    padding: 20,
    gap: 16,
    overflow: 'hidden',
  },
  stubTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stubHead: { flex: 1, gap: 5 },
  perforation: { flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 6, height: 1, backgroundColor: 'rgba(249,142,128,0.4)' },
  stubBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paid: { fontSize: 15, color: theme.dark.textPrimary, letterSpacing: 0 },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3] },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 17,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
  },
  secondary: { alignItems: 'center', paddingVertical: spacing[2] },
});

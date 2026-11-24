import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { describeApiError } from '@/lib/api';
import {
  createPaymentIntent,
  formatCountdown,
  formatMoney,
  getOrder,
  secondsUntil,
  syncOrder,
  type OrderDetail,
} from '@/lib/payments';
import { Text } from '@/components/text';
import { ErrorState } from '@/components/states';
import { Divider } from '@/components/gradient';
import { CARD_BORDER } from '@/components/ui';

/** The design's decline panel colour — the one red in an otherwise coral app. */
const DANGER_FILL = 'rgba(217,86,74,0.12)';
const DANGER_BORDER = 'rgba(217,86,74,0.5)';
const DANGER_TEXT = '#D9A9A2';

/**
 * There is deliberately no "card declined" state here.
 *
 * Design 25 draws one, but that design assumes card fields we own. With
 * PaymentSheet, a declined card is handled inside Stripe's own sheet — it
 * says so there and the buyer picks another card without the sheet ever
 * closing. The error codes this screen can receive are only Failed, Canceled
 * and Timeout; none of them means "your bank said no".
 *
 * So anything that reaches `failed` is ours or the system's, not the buyer's.
 * An early version labelled it "Your card was declined", which during testing
 * reported an invalid API key as the buyer's bank refusing them — a false
 * statement about their money that would send them to their bank over our bug.
 */
type Phase = 'loading' | 'ready' | 'paying' | 'confirming' | 'failed' | 'expired';

/**
 * Screens 22 and 25 — pay, and what a decline looks like.
 *
 * Card details are never handled here. `presentPaymentSheet` opens Stripe's
 * own native sheet, which is also what puts Apple Pay and Google Pay on the
 * screen; the design draws card fields inline, but re-implementing them would
 * put this app in PCI scope for no gain.
 */
export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const sheetReady = useRef(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError(null);
    try {
      const o = await getOrder(orderId);
      setOrder(o);
      // An order that was already paid — a webhook landing while this screen
      // was opening, say — should go straight to the ticket, not offer to
      // charge for it again.
      if (o.status === 'PAID') {
        router.replace({ pathname: '/checkout/success', params: { orderId } });
        return;
      }
      const remaining = secondsUntil(o.expiresAt);
      setLeft(remaining);
      setPhase(remaining === 0 ? 'expired' : 'ready');
    } catch (err) {
      setError(describeApiError(err, 'Could not load this order'));
      setPhase('ready');
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The hold countdown. Ticking locally and re-reading `expiresAt` rather than
  // decrementing blindly, so a backgrounded app does not come back believing
  // it still has the time it had when it left.
  useEffect(() => {
    if (!order || phase === 'expired') return;
    const tick = () => {
      const remaining = secondsUntil(order.expiresAt);
      setLeft(remaining);
      if (remaining === 0) setPhase('expired');
    };
    tick();
    const id = setInterval(tick, 1000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [order, phase]);

  async function pay() {
    if (!order || phase === 'paying' || phase === 'confirming') return;
    setPhase('paying');
    setError(null);
    setFailureMessage(null);
    try {
      const intent = await createPaymentIntent(order.id);

      if (!sheetReady.current) {
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Ekklesia Events',
          paymentIntentClientSecret: intent.clientSecret,
          // Apple Pay and Google Pay appear here only once a merchant id and
          // a Google Pay config are set up; cards work regardless.
          allowsDelayedPaymentMethods: false,
          appearance: {
            colors: {
              background: theme.dark.surface,
              componentBackground: theme.dark.surfaceRaised,
              primary: palette.coral[400],
              componentText: theme.dark.textPrimary,
              primaryText: theme.dark.textPrimary,
              secondaryText: theme.dark.textSecondary,
              placeholderText: theme.dark.textMuted,
              // 8-digit hex: Stripe's appearance API rejects rgba() outright
              // ("Expected hex string of length 6 or 8"), and it throws before
              // the sheet opens — which then reads as a payment failure.
              componentBorder: '#F98E804D',
            },
            shapes: { borderRadius: 14 },
          },
        });
        if (initError) throw new Error(initError.message);
        sheetReady.current = true;
      }

      const { error: sheetError } = await presentPaymentSheet();

      if (sheetError) {
        // Cancelling is not a failure — the buyer closed the sheet and the
        // seats are still theirs for the rest of the window.
        if (sheetError.code === 'Canceled') {
          setPhase('ready');
          return;
        }
        setFailureMessage(sheetError.message);
        setPhase('failed');
        // The spent sheet cannot be reused; the next attempt builds a new one.
        sheetReady.current = false;
        return;
      }

      // Paid. The webhook is probably already doing this, but it is neither
      // instant nor guaranteed, and the buyer is looking at the screen now.
      setPhase('confirming');
      const result = await syncOrder(order.id);
      if (result.status === 'PAID') {
        router.replace({ pathname: '/checkout/success', params: { orderId: order.id } });
      } else {
        // Stripe took the money but we could not confirm it yet. Say so
        // plainly rather than implying the payment failed.
        setError(
          'Your payment went through, but we are still confirming it. Your tickets will appear shortly.',
        );
        setPhase('ready');
      }
    } catch (err) {
      // Anything thrown here happened before Stripe saw a card: creating the
      // intent, initialising the sheet, the network. Not a decline.
      setFailureMessage(describeApiError(err, 'The payment could not be started'));
      setPhase('failed');
      sheetReady.current = false;
    }
  }

  if (phase === 'loading') {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={theme.dark.accent} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState message={error ?? 'Order not found'} onRetry={load} />
      </View>
    );
  }

  const when = new Date(order.event.startsAt).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const busy = phase === 'paying' || phase === 'confirming';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8} disabled={busy}>
          <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="monoLabel" tone="secondary" style={styles.topTitle}>
          {phase === 'failed' ? 'Payment' : 'Checkout'}
        </Text>
        <View style={styles.secure}>
          <Ionicons name="lock-closed" size={12} color={theme.dark.textSecondary} />
          <Text variant="caption" tone="secondary">
            Secure
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {phase === 'failed' ? (
          <View style={styles.declinePanel}>
            <Ionicons name="alert-circle" size={22} color={DANGER_TEXT} />
            <View style={styles.declineText}>
              <Text variant="subtitle" style={{ color: palette.coral[200] }}>
                We couldn&apos;t complete the payment
              </Text>
              <Text variant="footnote" style={{ color: DANGER_TEXT, lineHeight: 22 }}>
                {failureMessage ?? 'Something went wrong on our side.'} Nothing has been charged
                {left > 0 ? ' and your tickets are still held' : ''}.
              </Text>
            </View>
          </View>
        ) : null}

        {phase === 'expired' ? (
          <View style={styles.declinePanel}>
            <Ionicons name="time-outline" size={22} color={DANGER_TEXT} />
            <View style={styles.declineText}>
              <Text variant="subtitle" style={{ color: palette.coral[200] }}>
                Your tickets were released
              </Text>
              <Text variant="footnote" style={{ color: DANGER_TEXT, lineHeight: 22 }}>
                Reservations are held for a short time so they do not sit unused.
                Nothing was charged — choose your tickets again to continue.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.hold}>
            <Ionicons name="time-outline" size={15} color={theme.dark.accent} />
            <Text variant="label" tone="accent">
              Tickets held for {formatCountdown(left)}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.eventRow}>
            <View style={styles.thumb}>
              <Ionicons name="calendar-outline" size={22} color={theme.dark.textMuted} />
            </View>
            <View style={styles.eventText}>
              <Text variant="bodyLg" tone="onPhoto" numberOfLines={2}>
                {order.event.title}
              </Text>
              <Text variant="label" tone="secondary">
                {when}
              </Text>
            </View>
          </View>

          <Divider inset={0.08} opacity={0.2} />

          <View style={styles.lines}>
            {order.items.map((item) => (
              <View key={item.ticketType.id} style={styles.line}>
                <Text variant="footnote" tone="secondary">
                  {item.quantity} × {item.ticketType.name}
                </Text>
                <Text variant="mono" style={styles.lineAmount}>
                  {formatMoney(item.unitPriceMinor * item.quantity, order.currency)}
                </Text>
              </View>
            ))}
            {order.platformFeeMinor > 0 ? (
              <View style={styles.line}>
                <Text variant="footnote" tone="secondary">
                  Booking fee
                </Text>
                <Text variant="mono" style={styles.lineAmount}>
                  {formatMoney(order.platformFeeMinor, order.currency)}
                </Text>
              </View>
            ) : null}
            <View style={[styles.line, { paddingTop: 4 }]}>
              <Text variant="bodyLg">Total</Text>
              <Text variant="mono" style={styles.totalAmount}>
                {formatMoney(order.totalMinor, order.currency)}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <Text variant="label" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[5] }]}>
        {phase === 'expired' ? (
          <Pressable
            style={styles.payButton}
            onPress={() =>
              router.replace({
                pathname: '/event/[id]',
                params: { id: order.event.id },
              })
            }
          >
            <Text variant="subtitle" style={styles.payLabel}>
              Choose tickets again
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={pay}
            disabled={busy}
            style={({ pressed }) => [styles.payButton, (busy || pressed) && { opacity: 0.8 }]}
          >
            {busy ? (
              <>
                <ActivityIndicator color={theme.dark.backgroundDeep} />
                <Text variant="subtitle" style={styles.payLabel}>
                  {phase === 'confirming' ? 'Confirming…' : 'Opening payment…'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={16} color={theme.dark.backgroundDeep} />
                <Text variant="subtitle" style={styles.payLabel}>
                  {phase === 'failed'
                    ? 'Try again'
                    : `Pay ${formatMoney(order.totalMinor, order.currency)}`}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: 18,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { fontSize: 13, letterSpacing: 1.82 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 7, width: 70, justifyContent: 'flex-end' },
  body: { padding: spacing[5], gap: 14 },
  hold: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  declinePanel: {
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: DANGER_FILL,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
  },
  declineText: { flex: 1, gap: 6 },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: 12,
  },
  eventRow: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 11,
    backgroundColor: theme.dark.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventText: { flex: 1, gap: 4 },
  lines: { gap: 7 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineAmount: { color: palette.warm[300], letterSpacing: 0 },
  totalAmount: { fontSize: 16, color: theme.dark.textPrimary, letterSpacing: 0 },
  error: { color: palette.coral[300] },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  // The one light-on-dark control in the app: the design gives the pay button
  // the weight of a system sheet, because that is what it opens.
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 17,
    borderRadius: radius.full,
    backgroundColor: palette.warm[50],
  },
  payLabel: { color: theme.dark.backgroundDeep, fontSize: 17 },
});

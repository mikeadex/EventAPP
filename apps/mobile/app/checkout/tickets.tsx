import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { describeApiError } from '@/lib/api';
import {
  availableOf,
  createOrder,
  formatMoney,
  getPublicEvent,
  isOnSale,
  type PublicEvent,
  type TicketType,
} from '@/lib/payments';
import { Text } from '@/components/text';
import { ErrorState } from '@/components/states';
import { Divider } from '@/components/gradient';
import { ACTIVE_BORDER, ACTIVE_FILL, CARD_BORDER } from '@/components/ui';

/**
 * Screen 19 — choosing how many of which ticket.
 *
 * The running total here is computed locally only so the buyer can see the
 * sum change as they tap. It is never sent: `createOrder` posts quantities and
 * the server quotes the price it will actually charge. If the two ever
 * disagree, the next screen shows the server's.
 */
export default function ChooseTicketsScreen() {
  const insets = useSafeAreaInsets();
  const { orgSlug, eventSlug } = useLocalSearchParams<{ orgSlug: string; eventSlug: string }>();
  const [types, setTypes] = useState<TicketType[] | null>(null);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!orgSlug || !eventSlug) return;
    setError(null);
    try {
      const e = await getPublicEvent(orgSlug, eventSlug);
      setEvent(e);
      setTypes(e.ticketTypes);
    } catch (err) {
      setError(describeApiError(err, 'Could not load tickets'));
    }
  }, [orgSlug, eventSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const paidTypes = useMemo(() => (types ?? []).filter((t) => t.priceMinor > 0), [types]);

  const chosen = useMemo(
    () =>
      paidTypes
        .map((t) => ({ type: t, n: qty[t.id] ?? 0 }))
        .filter((x) => x.n > 0),
    [paidTypes, qty],
  );

  const subtotal = chosen.reduce((sum, { type, n }) => sum + type.priceMinor * n, 0);
  const currency = chosen[0]?.type.currency ?? paidTypes[0]?.currency ?? 'GBP';

  function bump(t: TicketType, delta: number) {
    setQty((prev) => {
      const next = Math.max(0, Math.min(availableOf(t), (prev[t.id] ?? 0) + delta));
      return { ...prev, [t.id]: next };
    });
  }

  async function toCheckout() {
    if (chosen.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const quote = await createOrder(
        event!.id,
        chosen.map(({ type, n }) => ({ ticketTypeId: type.id, quantity: n })),
      );
      router.replace({ pathname: '/checkout/[orderId]', params: { orderId: quote.orderId } });
    } catch (err) {
      // Reload: a 409 here almost always means somebody else took the last
      // seat, and the counts on screen are now wrong.
      setError(describeApiError(err, 'Could not start checkout'));
      void load();
    } finally {
      setSubmitting(false);
    }
  }

  const when = event
    ? new Date(event.startsAt).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="monoLabel" tone="secondary" style={styles.topTitle}>
          Choose tickets
        </Text>
        <View style={styles.back} />
      </View>

      {types === null ? (
        error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.dark.accent} />
          </View>
        )
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {event ? (
              <View style={styles.heading}>
                <Text variant="display" tone="onPhoto" style={{ fontSize: 24, lineHeight: 28 }}>
                  {event.title}
                </Text>
                <Text variant="label" tone="secondary">
                  {when}
                  {event.venue?.city ? ` · ${event.venue.city}` : ''}
                </Text>
              </View>
            ) : null}

            {paidTypes.length === 0 ? (
              <Text variant="body" tone="secondary" style={{ paddingHorizontal: spacing[5] }}>
                There are no paid tickets for this event.
              </Text>
            ) : null}

            {paidTypes.map((t) => {
              const left = availableOf(t);
              const onSale = isOnSale(t);
              const n = qty[t.id] ?? 0;
              const unavailable = left === 0 || !onSale;
              const selected = n > 0;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.tier,
                    selected && styles.tierSelected,
                    unavailable && styles.tierUnavailable,
                  ]}
                >
                  <View style={styles.tierTop}>
                    <View style={styles.tierText}>
                      <Text
                        variant="bodyLg"
                        style={{ color: selected ? palette.coral[200] : theme.dark.textPrimary }}
                      >
                        {t.name}
                      </Text>
                      <Text
                        variant="label"
                        style={{ color: selected ? palette.warm[400] : theme.dark.textSecondary }}
                      >
                        {!onSale
                          ? t.salesStart && new Date(t.salesStart) > new Date()
                            ? 'Not yet on sale'
                            : 'Sales closed'
                          : left === 0
                            ? 'Sold out'
                            : (t.description ?? `${t.quantity - t.sold} available`)}
                      </Text>
                    </View>
                    <Text
                      variant="mono"
                      style={[
                        styles.price,
                        { color: selected ? palette.coral[200] : theme.dark.textSecondary },
                      ]}
                    >
                      {formatMoney(t.priceMinor, t.currency)}
                    </Text>
                  </View>

                  {unavailable ? null : (
                    <>
                      <Divider inset={0.0} opacity={0.3} style={styles.tierRule} />
                      <View style={styles.tierBottom}>
                        <Text variant="label" style={{ color: palette.warm[400] }}>
                          {t.quantity - t.sold} left
                        </Text>
                        <View style={styles.stepper}>
                          <Pressable
                            onPress={() => bump(t, -1)}
                            disabled={n === 0}
                            hitSlop={8}
                            style={[styles.step, n === 0 && styles.stepDisabled]}
                          >
                            <Ionicons
                              name="remove"
                              size={18}
                              color={n === 0 ? theme.dark.textMuted : theme.dark.accent}
                            />
                          </Pressable>
                          <Text variant="mono" style={styles.stepCount}>
                            {n}
                          </Text>
                          <Pressable
                            onPress={() => bump(t, 1)}
                            disabled={n >= left}
                            hitSlop={8}
                            style={[styles.step, n >= left && styles.stepDisabled]}
                          >
                            <Ionicons
                              name="add"
                              size={18}
                              color={n >= left ? theme.dark.textMuted : theme.dark.accent}
                            />
                          </Pressable>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              );
            })}

            {error ? (
              <Text variant="label" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[5] }]}>
            {chosen.length > 0 ? (
              <View style={styles.summary}>
                {chosen.map(({ type, n }) => (
                  <View key={type.id} style={styles.summaryRow}>
                    <Text variant="footnote" tone="secondary">
                      {n} × {type.name}
                    </Text>
                    <Text variant="mono" style={{ color: palette.warm[300] }}>
                      {formatMoney(type.priceMinor * n, type.currency)}
                    </Text>
                  </View>
                ))}
                {/* No booking fee shown here: the server computes it, and
                    guessing at it would mean two different numbers if the rate
                    ever changes. The checkout screen shows the real quote. */}
                <View style={styles.summaryRow}>
                  <Text variant="subtitle">Subtotal</Text>
                  <Text variant="mono" style={styles.total}>
                    {formatMoney(subtotal, currency)}
                  </Text>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={toCheckout}
              disabled={chosen.length === 0 || submitting}
              style={({ pressed }) => [
                styles.cta,
                (chosen.length === 0 || submitting) && styles.ctaDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={theme.dark.accent} />
              ) : (
                <>
                  <Text variant="bodyLg" tone="accent">
                    Continue to checkout
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.dark.accent} />
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  list: { paddingBottom: spacing[6] },
  heading: { paddingHorizontal: spacing[5], paddingTop: 24, gap: 6 },
  tier: {
    marginHorizontal: spacing[5],
    marginTop: 12,
    padding: 17,
    borderRadius: 16,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: 12,
  },
  tierSelected: { backgroundColor: ACTIVE_FILL, borderColor: ACTIVE_BORDER },
  tierUnavailable: { opacity: 0.55 },
  tierTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  tierText: { flex: 1, gap: 5 },
  price: { fontSize: 18, letterSpacing: 0 },
  tierRule: { marginVertical: 2 },
  tierBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { borderColor: theme.dark.border },
  stepCount: { fontSize: 17, color: palette.coral[200], letterSpacing: 0, minWidth: 18, textAlign: 'center' },
  error: { color: palette.coral[300], paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: 14 },
  summary: { gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 17, color: theme.dark.textPrimary, letterSpacing: 0 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 17,
    borderRadius: radius.full,
    backgroundColor: ACTIVE_FILL,
    borderWidth: 1,
    borderColor: ACTIVE_BORDER,
  },
  ctaDisabled: { backgroundColor: 'transparent', borderColor: theme.dark.border },
});

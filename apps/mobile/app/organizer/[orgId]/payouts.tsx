import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { Text } from '@/components/text';
import { ErrorState } from '@/components/states';
import { Divider, Gradient } from '@/components/gradient';
import { CARD_BORDER } from '@/components/ui';

type PayoutStatus = 'NOT_STARTED' | 'ONBOARDING' | 'RESTRICTED' | 'ENABLED' | 'DISABLED';

interface ConnectStatus {
  status: PayoutStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  country: string;
}

/**
 * Design 33 — payouts.
 *
 * The design shows a host who is already taking money: a next-payout figure,
 * a period breakdown, a card ending. None of that exists until an account is
 * live, and most hosts opening this screen have no account at all. So the
 * screen leads with where they actually are, and the figures appear once
 * there are figures.
 */
export default function PayoutsScreen() {
  const insets = useSafeAreaInsets();
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setError(null);
    try {
      setStatus(await api<ConnectStatus>(`/v1/organizations/${orgId}/connect/status`));
    } catch (err) {
      setError(describeApiError(err, 'Could not check your payout status'));
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Onboarding happens in a browser and finishes outside the app, so there is
  // no callback to wait on — re-check whenever the host comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  async function startOnboarding() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>(
        `/v1/organizations/${orgId}/connect/onboard`,
        { method: 'POST' },
      );
      await Linking.openURL(url);
    } catch (err) {
      setError(describeApiError(err, 'Could not start payout setup'));
    } finally {
      setStarting(false);
    }
  }

  if (!status) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={theme.dark.accent} />
          </View>
        )}
      </View>
    );
  }

  const live = status.status === 'ENABLED';
  const headline: Record<PayoutStatus, string> = {
    NOT_STARTED: 'Set up payouts',
    ONBOARDING: 'Finish setting up payouts',
    RESTRICTED: 'Stripe needs to review your account',
    DISABLED: 'Payouts are turned off',
    ENABLED: 'You’re set up for payouts',
  };
  const blurb: Record<PayoutStatus, string> = {
    NOT_STARTED:
      'Stripe handles the money and pays you directly. Until this is done you can run free events, but you can’t sell tickets.',
    ONBOARDING:
      'Stripe still needs a few details. Until they have them you can run free events, but you can’t sell tickets.',
    RESTRICTED:
      'Stripe is reviewing your account and has paused payouts. They’ll contact you if they need anything.',
    DISABLED: 'Payouts are off for this account. Contact us and we’ll look into it.',
    ENABLED: 'Ticket money goes to your Stripe account. We keep only the booking fee.',
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="monoLabel" tone="secondary" style={styles.topTitle}>
          Payouts
        </Text>
        <View style={styles.roundBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Gradient
            angle={168}
            stops={[
              { at: 0, opacity: 1, color: '#221A1C' },
              { at: 0.62, opacity: 1, color: '#150F11' },
            ]}
            style={{ borderRadius: 20 }}
          />
          <View style={styles.heroHead}>
            <Text variant="monoLabel" tone="accent">
              {live ? 'Payouts' : 'Status'}
            </Text>
            <Text variant="title" tone="onPhoto" style={styles.heroTitle}>
              {headline[status.status]}
            </Text>
          </View>
          <Divider inset={0} opacity={0.28} />
          <View style={styles.heroFoot}>
            <Ionicons
              name={live ? 'checkmark-circle' : 'time-outline'}
              size={16}
              color={live ? theme.dark.accent : palette.warm[300]}
            />
            <Text variant="label" tone="secondary" style={{ flex: 1 }}>
              {blurb[status.status]}
            </Text>
          </View>
        </View>

        {/* What Stripe is waiting for, where there is anything. Naming it
            beats "incomplete" — a host can see whether it is five minutes of
            typing or a document they have to go and find. */}
        {status.requirementsDue.length > 0 ? (
          <View style={styles.card}>
            <Text variant="monoLabel" style={styles.cardLabel}>
              Outstanding
            </Text>
            {status.requirementsDue.slice(0, 6).map((r) => (
              <View key={r} style={styles.reqRow}>
                <View style={styles.dot} />
                <Text variant="label" tone="secondary" style={{ flex: 1 }}>
                  {humanise(r)}
                </Text>
              </View>
            ))}
            {status.requirementsDue.length > 6 ? (
              <Text variant="caption" tone="muted">
                and {status.requirementsDue.length - 6} more
              </Text>
            ) : null}
          </View>
        ) : null}

        {live ? (
          <View style={styles.card}>
            <Text variant="monoLabel" style={styles.cardLabel}>
              How you get paid
            </Text>
            <Text variant="label" tone="secondary" style={{ lineHeight: 21 }}>
              Stripe pays out to your bank on its own schedule — usually every
              few days. Amounts and dates live in your Stripe dashboard.
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text variant="label" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[5] }]}>
        <Pressable
          onPress={startOnboarding}
          disabled={starting}
          style={({ pressed }) => [styles.cta, (starting || pressed) && { opacity: 0.8 }]}
        >
          {starting ? (
            <ActivityIndicator color={theme.dark.accent} />
          ) : (
            <>
              <Ionicons name="open-outline" size={18} color={theme.dark.accent} />
              <Text variant="bodyLg" tone="accent">
                {status.status === 'NOT_STARTED'
                  ? 'Set up payouts with Stripe'
                  : live
                    ? 'Manage on Stripe'
                    : 'Continue on Stripe'}
              </Text>
            </>
          )}
        </Pressable>
        <Text variant="caption" tone="muted" style={styles.footnote}>
          Opens Stripe. We never see your bank details.
        </Text>
      </View>
    </View>
  );
}

/** `individual.verification.document` → "Individual verification document". */
function humanise(requirement: string): string {
  const words = requirement.replace(/_/g, ' ').split('.').join(' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: 18,
  },
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
  topTitle: { fontSize: 13, letterSpacing: 1.82 },
  body: { padding: spacing[5], gap: 14 },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.2)',
    padding: 22,
    gap: 16,
    overflow: 'hidden',
  },
  heroHead: { gap: 9 },
  heroTitle: { lineHeight: 28 },
  heroFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  card: {
    padding: 17,
    borderRadius: 14,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    gap: spacing[2],
  },
  cardLabel: { color: palette.warm[550], marginBottom: 2 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: palette.coral[400] },
  error: { color: palette.coral[300] },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3] },
  cta: {
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
  footnote: { textAlign: 'center' },
});

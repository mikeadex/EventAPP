import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Gradient } from '@/components/gradient';
import { api } from '@/lib/api';
import { showToast } from '@/components/toast';
import { locationMode } from '@/lib/event-location';

interface Ticket {
  id: string;
  code: string;
  status: string;
  showAsAttending: boolean;
  issuedAt: string | null;
  checkedInAt: string | null;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    isOnline: boolean;
    onlineUrl: string | null;
    coverImageUrl: string | null;
    organization: { slug: string; name: string };
    venue: { name: string; city: string; postalCode: string } | null;
  };
}

function TimeBlock({ label, iso }: { label: string; iso: string }) {
  const d = new Date(iso);
  return (
    <View style={{ flex: 1 }}>
      <Text variant="monoLabel" style={styles.timeLabel}>
        {label}
      </Text>
      <Text variant="display" style={styles.timeValue}>
        {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text variant="caption" tone="secondary" style={styles.timeDate}>
        {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visPending, setVisPending] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Ticket>(`/v1/tickets/${id}`)
      .then(setTicket)
      .catch((e) => setError(e.message));
  }, [id]);

  async function toggleVisibility(next: boolean) {
    if (!ticket || visPending) return;
    setVisPending(true);
    setTicket({ ...ticket, showAsAttending: next });
    try {
      await api(`/v1/tickets/${ticket.id}/visibility`, {
        method: 'PATCH',
        body: { showAsAttending: next },
      });
      showToast(next ? "You'll appear as going" : 'Hidden from the event page');
    } catch {
      setTicket((t) => (t ? { ...t, showAsAttending: !next } : t));
      showToast("Couldn't update visibility — try again");
    } finally {
      setVisPending(false);
    }
  }

  if (error) {
    return (
      <View style={[styles.c, styles.center, { padding: spacing[6] }]}>
        <StatusBar style="light" />
        <Ionicons name="cloud-offline-outline" size={44} color={palette.coral[500]} />
        <Text variant="body" tone="secondary" style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backChip}>
          <Text variant="body" tone="accent">Go back</Text>
        </Pressable>
      </View>
    );
  }
  if (!ticket) {
    return (
      <View style={[styles.c, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={theme.dark.accent} />
      </View>
    );
  }

  const checkedIn = ticket.status === 'CHECKED_IN';
  const mode = locationMode(ticket.event);
  // A hybrid ticket shows the venue, since that is what you need at the door;
  // the stream link gets its own line below rather than replacing it.
  const venueLine =
    mode === 'online'
      ? ticket.event.onlineUrl ?? 'Link to follow'
      : ticket.event.venue
      ? `${ticket.event.venue.name}, ${ticket.event.venue.city}`
      : 'Venue TBA';

  return (
    <View style={styles.c}>
      <StatusBar style="light" />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing[2] }]}>
        <Pressable onPress={() => router.back()} style={styles.roundBtn} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="monoLabel" tone="secondary" style={styles.topTitle}>
          Your ticket
        </Text>
        <View style={styles.roundBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[5], paddingBottom: insets.bottom + spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* The stub's own ground: a 168deg ramp, per the design. Drawn
              rather than flat-filled because the card is tall enough for the
              difference between its ends to read. */}
          <Gradient
            angle={168}
            stops={[
              { at: 0, opacity: 1, color: '#221A1C' },
              { at: 0.62, opacity: 1, color: '#150F11' },
            ]}
            style={{ borderRadius: radiusExtra.hero }}
          />
          {/* Top half */}
          <View style={styles.cardTop}>
            <Text variant="monoLabel" tone="accent" style={styles.kicker}>
              {ticket.event.organization.name}
            </Text>
            <Text variant="display" tone="onPhoto" style={styles.title}>
              {ticket.event.title}
            </Text>

            <Text variant="label" tone="secondary" style={styles.activeFrom}>
              Ticket will be active from
            </Text>
            <View style={styles.timeRow}>
              <TimeBlock label="Starts" iso={ticket.event.startsAt} />
              <View style={styles.timeArrow}>
                <Ionicons name="arrow-forward" size={16} color={theme.dark.accent} />
              </View>
              <TimeBlock label="Ends" iso={ticket.event.endsAt} />
            </View>
          </View>

          {/* Perforation */}
          <View style={styles.perforation}>
            <View style={[styles.notch, { left: -16 }]} />
            <View style={[styles.notch, { right: -16 }]} />
            {/* Real dash views, not `borderStyle: 'dashed'`. A dashed border
                on a single side does not render on iOS — the notches showed
                and the tear line between them simply was not there. */}
            <View style={styles.dashedLine}>
              {Array.from({ length: 26 }).map((_, i) => (
                <View key={i} style={styles.dash} />
              ))}
            </View>
          </View>

          {/* Bottom half — QR */}
          <View style={styles.cardBottom}>
            <View style={styles.qrBox}>
              {/* On the warm near-white the design gives it, not pure white:
                  a pure-white panel is the one thing on screen that is not
                  part of this palette. Contrast is unaffected — scanners
                  need the dark/light ratio, which is untouched. */}
              <QRCode value={ticket.code} size={188} ecl="H" backgroundColor="#FFF6F4" color="#0D0A0B" />
            </View>
            <Text variant="mono" style={styles.codeText}>
              {ticket.code}
            </Text>
            <Text variant="monoLabel" style={styles.showAt}>
              Show at registration
            </Text>

            <View style={styles.metaRow}>
              <View style={[styles.statusDot, checkedIn && styles.statusDotIn]} />
              <Text variant="label" tone="secondary">
                {checkedIn ? 'Checked in' : 'Valid · one scan per ticket'}
              </Text>
            </View>
            <View style={styles.venueRow}>
              <Ionicons
                name={mode === 'online' ? 'videocam-outline' : 'location-outline'}
                size={14}
                color={theme.dark.textMuted}
              />
              <Text variant="label" tone="secondary" style={styles.venueText} numberOfLines={1}>
                {venueLine}
              </Text>
            </View>

            {mode === 'hybrid' && (
              <Pressable
                style={styles.venueRow}
                disabled={!ticket.event.onlineUrl}
                onPress={() => ticket.event.onlineUrl && Linking.openURL(ticket.event.onlineUrl)}
              >
                <Ionicons name="videocam-outline" size={14} color={theme.dark.accent} />
                <Text variant="label" tone="accent" style={styles.venueText} numberOfLines={1}>
                  {ticket.event.onlineUrl ?? 'Stream link to follow'}
                </Text>
              </Pressable>
            )}

            {/* Withdrawable consent for the event page's "who's going" list. */}
            <View style={styles.visRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visLabel}>Show me as going</Text>
                <Text style={styles.visCaption}>Visible on the event page</Text>
              </View>
              <Switch
                value={ticket.showAsAttending}
                onValueChange={toggleVisibility}
                disabled={visPending}
                trackColor={{ false: theme.dark.border, true: palette.coral[600] }}
                thumbColor={palette.warm[50]}
              />
            </View>
          </View>
        </View>

        <Text style={styles.footHint}>
          Keep this screen handy — the host scans the code at the door.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  errorText: { textAlign: 'center' },
  backChip: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
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

  card: {
    borderRadius: radiusExtra.hero,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.18)',
  },
  cardTop: { paddingHorizontal: 24, paddingTop: 30, paddingBottom: 26 },
  // 0.24em at 10px, per the design — wider than the shared monoLabel.
  kicker: { fontSize: 10, letterSpacing: 2.4, textAlign: 'center' },
  title: { marginTop: 9, fontSize: 27, lineHeight: 30, textAlign: 'center' },
  activeFrom: { marginTop: spacing[5], textAlign: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing[3] },
  timeArrow: { paddingHorizontal: 11, marginTop: 12 },
  timeLabel: { fontSize: 10, letterSpacing: 2, color: palette.warm[550], textAlign: 'center' },
  timeValue: { fontSize: 26, lineHeight: 30, marginTop: 5, textAlign: 'center' },
  timeDate: { marginTop: 5, textAlign: 'center' },

  // The tear-off. The notches are the SCREEN colour punched over the card's
  // edge, so they read as holes rather than as dots sitting on top — which
  // means they have to match `c`, not the card.
  perforation: { position: 'relative', height: 0 },
  notch: {
    position: 'absolute',
    top: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.dark.backgroundDeep,
  },
  dashedLine: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    top: -1,
    height: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dash: { width: 6, height: 1, backgroundColor: 'rgba(249,142,128,0.42)' },

  cardBottom: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 24 },
  qrBox: {
    backgroundColor: '#FFF6F4',
    padding: 13,
    borderRadius: 16,
  },
  // 0.16em at 14px, per the design.
  codeText: { marginTop: 18, fontSize: 14, letterSpacing: 2.24, color: theme.dark.textPrimary },
  showAt: { marginTop: 7, fontSize: 12, letterSpacing: 1.68, color: palette.warm[550] },
  visRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    alignSelf: 'stretch',
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.dark.borderSubtle,
  },
  visLabel: { fontSize: fontSize.sm, color: theme.dark.textPrimary },
  visCaption: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[5] },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.dark.textMuted },
  statusDotIn: { backgroundColor: palette.coral[400] },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  venueText: { flexShrink: 1 },

  footHint: {
    marginTop: spacing[5],
    fontSize: fontSize.xs,
    color: theme.dark.textMuted,
    textAlign: 'center',
  },
});

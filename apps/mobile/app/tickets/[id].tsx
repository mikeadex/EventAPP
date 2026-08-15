import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
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
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>
        {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Text style={styles.timeDate}>
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
        <Ionicons name="cloud-offline-outline" size={44} color={color.ink[500]} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backChip}>
          <Text style={styles.backChipText}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  if (!ticket) {
    return (
      <View style={[styles.c, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={color.ink[0]} />
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
          <Ionicons name="chevron-back" size={20} color={color.ink[0]} />
        </Pressable>
        <Text style={styles.topTitle}>Your ticket</Text>
        <View style={styles.roundBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[5], paddingBottom: insets.bottom + spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Top half */}
          <View style={styles.cardTop}>
            <Text style={styles.kicker}>{ticket.event.organization.name}</Text>
            <Text style={styles.title}>{ticket.event.title}</Text>

            <Text style={styles.activeFrom}>Ticket will be active from</Text>
            <View style={styles.timeRow}>
              <TimeBlock label="Starts" iso={ticket.event.startsAt} />
              <View style={styles.timeArrow}>
                <Ionicons name="arrow-forward" size={16} color={color.ink[500]} />
              </View>
              <TimeBlock label="Ends" iso={ticket.event.endsAt} />
            </View>
          </View>

          {/* Perforation */}
          <View style={styles.perforation}>
            <View style={[styles.notch, { left: -12 }]} />
            <View style={[styles.notch, { right: -12 }]} />
            <View style={styles.dashedLine} />
          </View>

          {/* Bottom half — QR */}
          <View style={styles.cardBottom}>
            <View style={styles.qrBox}>
              <QRCode value={ticket.code} size={196} ecl="H" backgroundColor="#FFFFFF" color="#0A0A0A" />
            </View>
            <Text style={styles.codeText}>{ticket.code}</Text>
            <Text style={styles.showAt}>Show at registration</Text>

            <View style={styles.metaRow}>
              <View style={[styles.statusDot, checkedIn && styles.statusDotIn]} />
              <Text style={styles.metaText}>
                {checkedIn ? 'Checked in' : 'Valid · one scan per ticket'}
              </Text>
            </View>
            <View style={styles.venueRow}>
              <Ionicons
                name={mode === 'online' ? 'videocam-outline' : 'location-outline'}
                size={14}
                color={color.ink[500]}
              />
              <Text style={styles.venueText} numberOfLines={1}>
                {venueLine}
              </Text>
            </View>

            {mode === 'hybrid' && (
              <Pressable
                style={styles.venueRow}
                disabled={!ticket.event.onlineUrl}
                onPress={() => ticket.event.onlineUrl && Linking.openURL(ticket.event.onlineUrl)}
              >
                <Ionicons name="videocam-outline" size={14} color={color.ink[500]} />
                <Text style={styles.venueText} numberOfLines={1}>
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
                trackColor={{ false: color.ink[200], true: color.ink[900] }}
                thumbColor={color.ink[0]}
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
  c: { flex: 1, backgroundColor: color.ink[900] },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  errorText: { color: color.ink[300], fontSize: fontSize.base, textAlign: 'center' },
  backChip: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: color.ink[700],
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
  },
  backChipText: { color: color.ink[0], fontWeight: fontWeight.medium },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.ink[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold },

  card: {
    backgroundColor: color.ink[800],
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: color.ink[700],
  },
  cardTop: { padding: spacing[6], paddingBottom: spacing[6] },
  kicker: {
    fontSize: fontSize.xs,
    color: color.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    marginTop: spacing[2],
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: color.ink[0],
    textAlign: 'center',
  },
  activeFrom: {
    marginTop: spacing[5],
    fontSize: fontSize.sm,
    color: color.ink[400],
    textAlign: 'center',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[3] },
  timeArrow: { paddingHorizontal: spacing[2] },
  timeLabel: {
    fontSize: fontSize.xs,
    color: color.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: color.ink[0],
    marginTop: spacing[1],
  },
  timeDate: { fontSize: fontSize.xs, color: color.ink[400], marginTop: spacing[1] },

  perforation: { position: 'relative', height: 0 },
  notch: {
    position: 'absolute',
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: color.ink[900],
  },
  dashedLine: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    top: -1,
    height: 2,
    borderTopWidth: 2,
    borderColor: color.ink[700],
    borderStyle: 'dashed',
  },

  cardBottom: { alignItems: 'center', paddingVertical: spacing[8], paddingHorizontal: spacing[6] },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: spacing[4],
    borderRadius: radius.lg,
  },
  codeText: {
    marginTop: spacing[4],
    fontFamily: 'Courier',
    fontSize: fontSize.sm,
    letterSpacing: 2,
    color: color.ink[300],
  },
  showAt: { marginTop: spacing[2], fontSize: fontSize.xs, color: color.ink[500], letterSpacing: 1 },
  visRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    alignSelf: 'stretch',
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.ink[200],
  },
  visLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink[900] },
  visCaption: { fontSize: fontSize.xs, color: color.ink[500], marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[5] },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.ink[400] },
  statusDotIn: { backgroundColor: color.ink[0] },
  metaText: { fontSize: fontSize.sm, color: color.ink[300] },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  venueText: { fontSize: fontSize.sm, color: color.ink[400], flexShrink: 1 },

  footHint: {
    marginTop: spacing[5],
    fontSize: fontSize.xs,
    color: color.ink[500],
    textAlign: 'center',
  },
});

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ExpoCalendar from 'expo-calendar';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { useSession } from '@/lib/auth-client';
import { api, ApiError } from '@/lib/api';
import { FadeIn, Skeleton } from '@/components/states';
import { showToast } from '@/components/toast';

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_H * 0.56);
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

function mapsUrl(query: string) {
  const q = encodeURIComponent(query);
  return (
    Platform.select({
      ios: `maps:0,0?q=${q}`,
      android: `geo:0,0?q=${q}`,
    }) ?? `https://www.google.com/maps/search/?api=1&query=${q}`
  );
}

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  organization: { slug: string; name: string };
  venue: { name: string; city: string; postalCode: string } | null;
  ticketTypes: { priceMinor: number }[];
}

/** Translucent circular control overlaid on the hero. */
function RoundButton({
  icon,
  onPress,
  label,
  filled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
  filled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.roundBtn}>
      <Ionicons name={icon} size={20} color={filled ? color.ink[0] : color.ink[0]} />
    </Pressable>
  );
}

/** One column of the info strip. Tappable when `onPress` is given (e.g. maps). */
function InfoCol({
  label,
  value,
  sub,
  onPress,
  actionIcon = 'navigate-circle',
}: {
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
  actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const inner = (
    <>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
        {onPress ? <Ionicons name={actionIcon} size={15} color={color.ink[300]} /> : null}
      </View>
      {sub ? (
        <Text style={styles.infoSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable style={styles.infoCol} onPress={onPress}>
      {inner}
    </Pressable>
  ) : (
    <View style={styles.infoCol}>{inner}</View>
  );
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; orgSlug?: string; eventSlug?: string }>();
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [rsvpState, setRsvpState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [rsvpErr, setRsvpErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function load() {
      try {
        if (params.orgSlug && params.eventSlug) {
          const e = await api<EventDetail>(
            `/v1/organizations/${params.orgSlug}/events/${params.eventSlug}`,
          );
          setEvent(e);
        } else if (params.id) {
          const feed = await api<{ items: { id: string; slug: string; organization: { slug: string } }[] }>(
            '/v1/events?limit=50',
          );
          const match = feed.items.find((i) => i.id === params.id);
          if (!match) throw new Error('Event not in current feed');
          const e = await api<EventDetail>(
            `/v1/organizations/${match.organization.slug}/events/${match.slug}`,
          );
          setEvent(e);
        }
      } catch (e) {
        setLoadErr((e as Error).message);
      }
    }
    void load();
  }, [params.id, params.orgSlug, params.eventSlug]);

  useEffect(() => {
    if (!session?.user || !event) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api<{ event: { id: string } }[]>('/v1/me/saved-events');
        if (!cancelled) setSaved(list.some((s) => s.event.id === event.id));
      } catch {
        // ignore — non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, event]);

  async function toggleSave() {
    if (!session?.user) {
      router.push('/auth/sign-in');
      return;
    }
    if (!event || saving) return;
    setSaving(true);
    const next = !saved;
    setSaved(next);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.3, speed: 40, bounciness: 12, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true }),
    ]).start();
    showToast(next ? 'Saved for later' : 'Removed from Saved', next ? 'heart' : undefined);
    try {
      await api(`/v1/me/saved-events/${event.id}`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setSaved(!next);
      showToast("Couldn't update Saved — check your connection");
    } finally {
      setSaving(false);
    }
  }

  async function rsvp() {
    if (!session?.user) {
      router.push('/auth/sign-in');
      return;
    }
    if (!event) return;
    setRsvpState('pending');
    setRsvpErr(null);
    try {
      await api(`/v1/events/${event.id}/rsvp`, { method: 'POST', body: {} });
      setRsvpState('done');
    } catch (e) {
      setRsvpState('idle');
      setRsvpErr(e instanceof ApiError ? e.message : 'RSVP failed');
    }
  }

  async function shareEvent() {
    if (!event) return;
    const when = new Date(event.startsAt).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
    const where = event.isOnline
      ? 'Online'
      : event.venue
      ? `${event.venue.name}, ${event.venue.city}`
      : '';
    const url = WEB_URL ? `${WEB_URL}/${event.organization.slug}/${event.slug}` : undefined;
    const lines = [
      event.title,
      `${when}${where ? ` · ${where}` : ''}`,
      `Hosted by ${event.organization.name}`,
    ];
    if (url) lines.push(url);
    try {
      await Share.share({ title: event.title, message: lines.join('\n'), url });
    } catch {
      // user dismissed / share unavailable — ignore
    }
  }

  async function addToCalendar() {
    if (!event) return;
    const startDate = new Date(event.startsAt);
    // Fall back to a 2h block if the event has no end time.
    const endDate = event.endsAt
      ? new Date(event.endsAt)
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const location = event.isOnline
      ? 'Online'
      : event.venue
      ? `${event.venue.name}, ${event.venue.city}`
      : undefined;
    try {
      // Opens the system "new event" editor pre-filled — no calendar
      // permission needed (EventKitUI on iOS, ACTION_INSERT intent on Android).
      await ExpoCalendar.createEventInCalendarAsync({
        title: event.title,
        startDate,
        endDate,
        location,
        notes: event.summary ?? undefined,
      });
    } catch {
      // user dismissed / no calendar app — ignore
    }
  }

  function openMaps() {
    if (!event?.venue) return;
    const query = `${event.venue.name}, ${event.venue.city} ${event.venue.postalCode ?? ''}`.trim();
    Linking.openURL(mapsUrl(query)).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      );
    });
  }

  if (loadErr) {
    return (
      <View style={[styles.c, styles.center, { padding: spacing[6] }]}>
        <StatusBar style="light" />
        <Ionicons name="cloud-offline-outline" size={44} color={color.ink[500]} />
        <Text style={styles.errorText}>{loadErr}</Text>
        <Pressable onPress={() => router.back()} style={styles.backChip}>
          <Text style={styles.backChipText}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  if (!event) {
    // Skeleton mirroring the real layout: hero, title + social proof,
    // the three-column info strip, byline and about copy.
    return (
      <View style={styles.c}>
        <StatusBar style="light" />
        <Skeleton tone="dark" style={{ width: '100%', height: HERO_H, borderRadius: 0 }} />
        <View style={{ padding: spacing[5], gap: spacing[3] }}>
          <Skeleton tone="dark" style={{ height: 30, width: '72%' }} />
          <Skeleton tone="dark" style={{ height: 16, width: '45%' }} />
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] }}>
            <Skeleton tone="dark" style={{ flex: 1, height: 56 }} />
            <Skeleton tone="dark" style={{ flex: 1, height: 56 }} />
            <Skeleton tone="dark" style={{ flex: 1, height: 56 }} />
          </View>
          <Skeleton tone="dark" style={{ height: 14, width: '38%', marginTop: spacing[4] }} />
          <Skeleton tone="dark" style={{ height: 14, width: '92%' }} />
          <Skeleton tone="dark" style={{ height: 14, width: '80%' }} />
        </View>
      </View>
    );
  }

  const isFree = event.ticketTypes.every((t) => t.priceMinor === 0);
  const seatsLeft = event.capacity !== null ? event.capacity - event.attendeeCount : null;
  const soldOut = seatsLeft !== null && seatsLeft <= 0;
  const start = new Date(event.startsAt);
  const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const locStr = event.isOnline
    ? 'Online'
    : event.venue
    ? event.venue.city || event.venue.name
    : 'TBA';
  const rsvpDisabled = rsvpState !== 'idle' || soldOut || !isFree;
  const priceLabel = isFree ? 'Free' : 'Paid';
  const ctaText =
    rsvpState === 'done'
      ? "You're going ✓"
      : soldOut
      ? 'Sold out'
      : `Get a Ticket · ${priceLabel}`;

  return (
    <View style={styles.c}>
      <StatusBar style="light" />
      <FadeIn>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { height: HERO_H }]}>
          {event.coverImageUrl ? (
            <Image source={{ uri: event.coverImageUrl }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroFallback]}>
              <Ionicons name="calendar-outline" size={56} color={color.ink[600]} />
            </View>
          )}
          {/* Scrim so overlaid text stays legible on any photo */}
          <View style={styles.scrim} />

          {/* Top bar */}
          <View style={[styles.topBar, { top: insets.top + spacing[1] }]}>
            <RoundButton icon="chevron-back" onPress={() => router.back()} label="Go back" />
            <Text style={styles.topTitle}>Details</Text>
            <RoundButton icon="share-outline" onPress={shareEvent} label="Share event" />
          </View>

          {/* Title + social proof overlaid at the bottom of the hero */}
          <View style={styles.heroFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {event.title}
              </Text>
              <View style={styles.proofRow}>
                <View style={styles.avatars}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.proofAvatar, { marginLeft: i === 0 ? 0 : -10 }]}>
                      <Ionicons name="person" size={11} color={color.ink[300]} />
                    </View>
                  ))}
                </View>
                <Text style={styles.proofText}>
                  {event.attendeeCount > 0
                    ? `+${event.attendeeCount} going`
                    : 'Be the first to go'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={toggleSave}
              style={[styles.heart, saved && styles.heartActive]}
              accessibilityLabel={saved ? 'Unsave' : 'Save'}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={saved ? 'heart' : 'heart-outline'}
                  size={22}
                  color={saved ? color.ink[900] : color.ink[0]}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        {/* Info strip */}
        <View style={styles.infoStrip}>
          <InfoCol
            label="Location"
            value={locStr}
            onPress={!event.isOnline && event.venue ? openMaps : undefined}
          />
          <View style={styles.vDivider} />
          <InfoCol label="Date" value={dateStr} onPress={addToCalendar} actionIcon="add-circle" />
          <View style={styles.vDivider} />
          <InfoCol label="Time" value={timeStr} onPress={addToCalendar} actionIcon="add-circle" />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.byLine} onPress={() =>
            router.push({ pathname: '/host/[slug]', params: { slug: event.organization.slug } })
          }>
            By <Text style={styles.byName}>{event.organization.name}</Text>
          </Text>
          <Text style={styles.sectionTitle}>About this event</Text>
          <Text style={styles.about}>
            {event.description || event.summary || 'Details coming soon.'}
          </Text>
          {seatsLeft !== null ? (
            <Text style={styles.capacity}>
              {soldOut ? 'At capacity' : `${seatsLeft} spots left`}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Fixed bottom CTA pill */}
      <View style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
        {rsvpErr ? <Text style={styles.rsvpErr}>{rsvpErr}</Text> : null}
        <Pressable
          style={[styles.ctaPill, rsvpDisabled && rsvpState !== 'done' && styles.ctaPillDisabled]}
          disabled={rsvpDisabled}
          onPress={rsvp}
        >
          <View style={styles.ctaIcon}>
            {rsvpState === 'pending' ? (
              <ActivityIndicator color={color.ink[900]} size="small" />
            ) : (
              <Ionicons
                name={rsvpState === 'done' ? 'checkmark' : 'ticket'}
                size={18}
                color={color.ink[900]}
              />
            )}
          </View>
          <Text style={styles.ctaText}>{ctaText}</Text>
          {rsvpState === 'idle' && !soldOut ? (
            <Ionicons name="chevron-forward" size={20} color={color.ink[400]} />
          ) : (
            <View style={{ width: 20 }} />
          )}
        </Pressable>
      </View>
      </FadeIn>
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

  hero: { width: '100%', backgroundColor: color.ink[800], position: 'relative' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    height: 200,
    bottom: 0,
    backgroundColor: 'rgba(10,9,7,0.55)',
  },
  topBar: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20,20,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFooter: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[5],
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[3],
  },
  title: {
    color: color.ink[0],
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  avatars: { flexDirection: 'row' },
  proofAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.ink[700],
    borderWidth: 1.5,
    borderColor: color.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofText: { color: color.ink[300], fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  heart: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(40,40,40,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartActive: { backgroundColor: color.ink[0] },

  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[5],
  },
  infoCol: { flex: 1 },
  infoLabel: {
    color: color.ink[500],
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[1],
  },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  infoValue: { color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold, flexShrink: 1 },
  infoSub: { color: color.ink[400], fontSize: fontSize.sm, marginTop: 1 },
  vDivider: { width: 1, height: 36, backgroundColor: color.ink[700], marginHorizontal: spacing[3] },

  section: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  byLine: { color: color.ink[400], fontSize: fontSize.sm, marginBottom: spacing[4] },
  byName: { color: color.ink[0], fontWeight: fontWeight.semibold },
  sectionTitle: {
    color: color.ink[0],
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing[2],
  },
  about: { color: color.ink[400], fontSize: fontSize.base, lineHeight: 24 },
  capacity: { color: color.ink[500], fontSize: fontSize.sm, marginTop: spacing[4] },

  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  rsvpErr: {
    color: color.ink[300],
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: color.ink[800],
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: color.ink[700],
  },
  ctaPillDisabled: { opacity: 0.5 },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.ink[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { flex: 1, color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});

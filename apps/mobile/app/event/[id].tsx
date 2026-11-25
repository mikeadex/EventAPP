import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ExpoCalendar from 'expo-calendar';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Divider, Scrim, scrimPreset } from '@/components/gradient';
import { CARD_BORDER } from '@/components/ui';
import { useSession } from '@/lib/auth-client';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/payments';
import { FadeIn, Skeleton } from '@/components/states';
import { showToast } from '@/components/toast';
import { EventGallery, type GalleryItem } from '@/components/event-gallery';
import { ReportSheet } from '@/components/report-sheet';
import { registerForPush } from '@/lib/push';
import { locationLabel, locationLine, locationMode } from '@/lib/event-location';

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
  onlineUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  organization: { slug: string; name: string };
  venue: { name: string; city: string; postalCode: string } | null;
  ticketTypes: { priceMinor: number; currency: string; sold: number; quantity: number }[];
  /** Set when this event is one occurrence of a repeating series. */
  recurrence: { id: string; description: string } | null;
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
      <Ionicons name={icon} size={20} color={theme.dark.textPrimary} />
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
      <Text variant="monoLabel" style={styles.infoLabel}>
        {label}
      </Text>
      <View style={styles.infoValueRow}>
        <Text variant="subtitle" style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
        {onPress ? <Ionicons name={actionIcon} size={15} color={theme.dark.accent} /> : null}
      </View>
      {sub ? (
        <Text variant="label" tone="secondary" numberOfLines={1}>
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
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [reporting, setReporting] = useState(false);
  const [rsvpState, setRsvpState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [rsvpErr, setRsvpErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  // Who's going (opted-in attendees) + the post-RSVP celebration sheet.
  const [attendees, setAttendees] = useState<{ name: string; image: string | null }[]>([]);
  const [celebrate, setCelebrate] = useState(false);
  const [rsvpTicketId, setRsvpTicketId] = useState<string | null>(null);
  const [showMe, setShowMe] = useState(false);
  const [showMePending, setShowMePending] = useState(false);

  const refreshAttendees = (eventId: string) => {
    api<{ items: { name: string; image: string | null }[] }>(`/v1/events/${eventId}/attendees`)
      .then((d) => setAttendees(d.items))
      .catch(() => {});
  };

  useEffect(() => {
    if (event?.id) refreshAttendees(event.id);
  }, [event?.id]);

  useEffect(() => {
    async function load() {
      try {
        if (params.orgSlug && params.eventSlug) {
          const e = await api<EventDetail>(
            `/v1/organizations/${params.orgSlug}/events/${params.eventSlug}`,
          );
          setEvent(e);
        } else if (params.id) {
          const feed = await api<{
            items: { id: string; slug: string; organization: { slug: string } }[];
          }>('/v1/events?limit=50');
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

  // Fetched separately from the event, and deliberately not blocking it: a
  // gallery that fails to load should cost you the photos, not the page.
  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    void api<GalleryItem[]>(`/v1/events/${event.id}/media`)
      .then((items) => {
        if (!cancelled) setGallery(items);
      })
      .catch(() => {
        /* no gallery rather than a broken event page */
      });
    return () => {
      cancelled = true;
    };
  }, [event]);

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
    // Already holding an active ticket? Reflect it immediately: the CTA reads
    // "You're going ✓" instead of re-offering registration, and the ticket id
    // is kept so "Show me as going" still works from this page's sheet state.
    (async () => {
      try {
        const tickets = await api<{ id: string; event: { id: string } }[]>('/v1/me/tickets');
        const mine = tickets.find((t) => t.event.id === event.id);
        if (!cancelled && mine) {
          setRsvpState('done');
          setRsvpTicketId(mine.id);
        }
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
      Animated.spring(heartScale, {
        toValue: 1.3,
        speed: 40,
        bounciness: 12,
        useNativeDriver: true,
      }),
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
      const res = await api<{ tickets: { id: string }[] }>(`/v1/events/${event.id}/rsvp`, {
        method: 'POST',
        body: {},
      });
      setRsvpState('done');
      // The moment after committing to go is the app's emotional peak —
      // open the celebration sheet with the two follow-ups that matter:
      // add to calendar, and (opt-in) appear in "who's going".
      setRsvpTicketId(res.tickets[0]?.id ?? null);
      setShowMe(false);
      setCelebrate(true);
      // The only moment where asking for notifications explains itself: they
      // have just committed to being somewhere, so a reminder is obviously
      // wanted. iOS grants one prompt per install, so it is spent here rather
      // than on launch. Fire-and-forget — declining is a choice, not an error.
      void registerForPush({ prompt: true });
    } catch (e) {
      // The server refusing a duplicate is confirmation, not an error —
      // settle into the "going" state instead of showing a red message.
      if (e instanceof ApiError && e.status === 409) {
        setRsvpState('done');
        showToast('You already have a ticket for this event');
        return;
      }
      setRsvpState('idle');
      setRsvpErr(e instanceof ApiError ? e.message : 'RSVP failed');
    }
  }

  async function toggleShowMe(next: boolean) {
    if (!rsvpTicketId || showMePending) return;
    setShowMe(next);
    setShowMePending(true);
    try {
      await api(`/v1/tickets/${rsvpTicketId}/visibility`, {
        method: 'PATCH',
        body: { showAsAttending: next },
      });
      if (event?.id) refreshAttendees(event.id);
    } catch {
      setShowMe(!next);
      showToast("Couldn't update visibility — try again");
    } finally {
      setShowMePending(false);
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
    const where = locationLine(event);
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
      // User-cancel resolves (doesn't throw) on both platforms, so reaching
      // here means the share sheet genuinely failed — don't fail silently.
      showToast("Couldn't open the share sheet");
    }
  }

  async function addToCalendar() {
    if (!event) return;
    const startDate = new Date(event.startsAt);
    // Fall back to a 2h block if the event has no end time.
    const endDate = event.endsAt
      ? new Date(event.endsAt)
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    // Hybrid puts the venue in the calendar entry and mentions the stream, so
    // the entry is useful whichever way the person ends up attending.
    const location = locationLine(event) || undefined;
    try {
      // Android launches an ACTION_INSERT intent, which needs no permission.
      // iOS is different: expo-calendar's native createEventInCalendarAsync
      // runs checkCalendarPermissions() BEFORE presenting the editor, so
      // without a granted permission it throws and nothing appears. Request
      // it explicitly on iOS (the usage strings ship in the binary).
      if (Platform.OS === 'ios') {
        const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          showToast('Allow calendar access in Settings to add events');
          return;
        }
      }
      const result = await ExpoCalendar.createEventInCalendarAsync({
        title: event.title,
        startDate,
        endDate,
        location,
        notes: event.summary ?? undefined,
      });
      if ((result as { action?: string } | null)?.action === 'saved') {
        showToast('Added to your calendar', 'calendar-outline');
      }
    } catch {
      // A real failure (not user cancel — that resolves with action:
      // "canceled"). Say so instead of silently doing nothing: today's
      // "nothing happened" bug report existed because this was swallowed.
      showToast("Couldn't open your calendar");
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
        <Ionicons name="cloud-offline-outline" size={44} color={palette.coral[500]} />
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
        <Skeleton style={{ width: '100%', height: HERO_H, borderRadius: 0 }} />
        <View style={{ padding: spacing[5], gap: spacing[3] }}>
          <Skeleton style={{ height: 30, width: '72%' }} />
          <Skeleton style={{ height: 16, width: '45%' }} />
          <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] }}>
            <Skeleton style={{ flex: 1, height: 56 }} />
            <Skeleton style={{ flex: 1, height: 56 }} />
            <Skeleton style={{ flex: 1, height: 56 }} />
          </View>
          <Skeleton style={{ height: 14, width: '38%', marginTop: spacing[4] }} />
          <Skeleton style={{ height: 14, width: '92%' }} />
          <Skeleton style={{ height: 14, width: '80%' }} />
        </View>
      </View>
    );
  }

  const isFree = event.ticketTypes.every((t) => t.priceMinor === 0);
  const seatsLeft = event.capacity !== null ? event.capacity - event.attendeeCount : null;
  const soldOut = seatsLeft !== null && seatsLeft <= 0;
  const start = new Date(event.startsAt);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeStr = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const locStr = locationLabel(event);
  const mode = locationMode(event);
  // Paid events used to disable this button outright, which left the only
  // way to buy a ticket as "you cannot". They now go to the checkout flow.
  const rsvpDisabled = rsvpState !== 'idle' || soldOut;
  // The cheapest tier someone can actually buy. Quoting a sold-out tier —
  // which is usually the cheapest, that being why it sold out — advertises a
  // price that is not available to anybody.
  const cheapest = isFree
    ? null
    : event.ticketTypes
        .filter((t) => t.priceMinor > 0 && t.sold < t.quantity)
        .reduce<{
          priceMinor: number;
          currency: string;
        } | null>((lo, t) => (lo === null || t.priceMinor < lo.priceMinor ? t : lo), null);
  const priceLabel = isFree
    ? 'Free'
    : cheapest
      ? `from ${formatMoney(cheapest.priceMinor, cheapest.currency)}`
      : 'Paid';
  const ctaText =
    rsvpState === 'done'
      ? "You're going ✓"
      : soldOut
        ? 'Sold out'
        : isFree
          ? 'Get a Ticket · Free'
          : `Get a Ticket · ${priceLabel}`;

  return (
    <View style={styles.c}>
      <StatusBar style="light" />
      <FadeIn>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[styles.hero, { height: HERO_H }]}>
            {event.coverImageUrl ? (
              <Image source={{ uri: event.coverImageUrl }} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.heroFallback]}>
                <Ionicons name="calendar-outline" size={56} color={theme.dark.textMuted} />
              </View>
            )}
            {/* Drawn with SVG, like Discover's — a flat 55% wash over the
              lower third was what this used before, and it both muddied the
              photograph and left the top bar sitting on bare image. */}
            <Scrim stops={scrimPreset.hero} />

            {/* Top bar */}
            <View style={[styles.topBar, { top: insets.top + spacing[1] }]}>
              <RoundButton icon="chevron-back" onPress={() => router.back()} label="Go back" />
              <Text variant="monoLabel" tone="secondary" style={styles.topTitle}>
                Details
              </Text>
              <View style={styles.topActions}>
                <RoundButton icon="share-outline" onPress={shareEvent} label="Share event" />
                <RoundButton
                  icon="flag-outline"
                  onPress={() => setReporting(true)}
                  label="Report this event"
                />
              </View>
            </View>

            {/* Title + social proof overlaid at the bottom of the hero */}
            <View style={styles.heroFooter}>
              <View style={{ flex: 1 }}>
                <Text variant="hero" tone="onPhoto" style={styles.title} numberOfLines={2}>
                  {event.title}
                </Text>
                <View style={styles.proofRow}>
                  <View style={styles.avatars}>
                    {attendees.length > 0
                      ? attendees.slice(0, 4).map((a, i) => (
                          <View
                            key={`${a.name}-${i}`}
                            style={[styles.proofAvatar, { marginLeft: i === 0 ? 0 : -10 }]}
                          >
                            {a.image ? (
                              <Image source={{ uri: a.image }} style={styles.proofAvatarImg} />
                            ) : (
                              <Text variant="caption" style={styles.proofAvatarInitial}>
                                {a.name.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                        ))
                      : [0, 1, 2].map((i) => (
                          <View
                            key={i}
                            style={[styles.proofAvatar, { marginLeft: i === 0 ? 0 : -10 }]}
                          >
                            <Ionicons name="person" size={11} color={theme.dark.accent} />
                          </View>
                        ))}
                  </View>
                  <Text variant="footnote" style={styles.proofText} numberOfLines={1}>
                    {attendees.length > 0
                      ? `${attendees[0].name.split(' ')[0]}${
                          event.attendeeCount > 1 ? ` and ${event.attendeeCount - 1} others` : ''
                        } going`
                      : event.attendeeCount > 0
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
                    color={saved ? palette.coral[300] : theme.dark.textPrimary}
                  />
                </Animated.View>
              </Pressable>
            </View>
          </View>

          {/* Info strip */}
          <View style={styles.infoStrip}>
            <InfoCol label="Location" value={locStr} onPress={event.venue ? openMaps : undefined} />
            <Divider orientation="vertical" inset={0.3} opacity={0.28} style={styles.vDivider} />
            <InfoCol label="Date" value={dateStr} onPress={addToCalendar} actionIcon="add-circle" />
            <Divider orientation="vertical" inset={0.3} opacity={0.28} style={styles.vDivider} />
            <InfoCol label="Time" value={timeStr} onPress={addToCalendar} actionIcon="add-circle" />
          </View>

          {/* Says this is one of a series, next to the single date above it.
            Without this the page shows one Wednesday and gives no hint the
            others exist — and discovery deliberately shows only one, so this
            is the only place someone learns it repeats. */}
          {event.recurrence ? (
            <View style={styles.repeatRow}>
              <Ionicons name="repeat" size={15} color={theme.dark.accent} />
              <Text variant="footnote" tone="secondary">
                {event.recurrence.description}
              </Text>
            </View>
          ) : null}

          {/* The stream. Previously the link was never shown here at all — even an
            online-only event only revealed it on the ticket after registering. */}
          {mode !== 'in_person' && (
            <Pressable
              style={styles.onlineRow}
              disabled={!event.onlineUrl}
              onPress={() => event.onlineUrl && Linking.openURL(event.onlineUrl)}
            >
              <Ionicons name="videocam-outline" size={18} color={theme.dark.accent} />
              <View style={{ flex: 1 }}>
                <Text variant="footnote" style={styles.onlineTitle}>
                  {mode === 'hybrid' ? 'Also streaming online' : 'Watch online'}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {event.onlineUrl ?? 'Link to follow'}
                </Text>
              </View>
              {event.onlineUrl ? (
                <Ionicons name="open-outline" size={16} color={theme.dark.textMuted} />
              ) : null}
            </Pressable>
          )}

          {/* About */}
          <View style={styles.section}>
            <Text
              style={styles.byLine}
              onPress={() =>
                router.push({ pathname: '/host/[slug]', params: { slug: event.organization.slug } })
              }
            >
              By{' '}
              <Text variant="footnote" style={styles.byName}>
                {event.organization.name}
              </Text>
            </Text>
            <Text variant="subtitle" style={styles.sectionTitle}>
              About this event
            </Text>
            <Text variant="body" style={styles.about}>
              {event.description || event.summary || 'Details coming soon.'}
            </Text>
            {seatsLeft !== null ? (
              <Text variant="label" tone="accent" style={styles.capacity}>
                {soldOut ? 'At capacity' : `${seatsLeft} spots left`}
              </Text>
            ) : null}

            {gallery.length > 0 ? (
              <View style={styles.gallery}>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  Photos and video
                </Text>
                <EventGallery items={gallery} />
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Fixed bottom CTA pill */}
        <View style={[styles.bottomWrap, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>
          {rsvpErr ? (
            <Text variant="label" style={styles.rsvpErr}>
              {rsvpErr}
            </Text>
          ) : null}
          <Pressable
            style={[styles.ctaPill, rsvpDisabled && rsvpState !== 'done' && styles.ctaPillDisabled]}
            disabled={rsvpDisabled}
            onPress={
              isFree
                ? rsvp
                : () =>
                    router.push({
                      pathname: '/checkout/tickets',
                      params: {
                        orgSlug: event.organization.slug,
                        eventSlug: event.slug,
                      },
                    })
            }
          >
            {rsvpState === 'pending' ? (
              <ActivityIndicator color={theme.dark.accent} size="small" />
            ) : (
              <Ionicons
                name={rsvpState === 'done' ? 'checkmark' : 'ticket'}
                size={18}
                color={
                  rsvpDisabled && rsvpState !== 'done' ? theme.dark.textMuted : theme.dark.accent
                }
              />
            )}
            <Text
              variant="bodyLg"
              style={{
                color:
                  rsvpDisabled && rsvpState !== 'done' ? theme.dark.textMuted : palette.coral[200],
              }}
            >
              {ctaText}
            </Text>
          </Pressable>
        </View>
      </FadeIn>

      {/* Post-RSVP celebration: calendar + who's-going opt-in. */}
      <Modal
        visible={celebrate}
        transparent
        animationType="slide"
        onRequestClose={() => setCelebrate(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setCelebrate(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5] }]}>
          <View style={styles.sheetHandle} />
          <Ionicons name="checkmark-circle" size={44} color={theme.dark.accent} />
          <Text variant="title" tone="onPhoto" style={styles.sheetTitle}>
            You&apos;re going
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {event.title} · {dateStr}
          </Text>

          <Pressable style={styles.sheetAction} onPress={addToCalendar}>
            <Ionicons name="calendar-outline" size={20} color={theme.dark.textSecondary} />
            <Text variant="bodyLg" style={styles.sheetActionText}>
              Add to calendar
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.dark.textMuted} />
          </Pressable>

          <View style={styles.sheetAction}>
            <Ionicons name="people-outline" size={20} color={theme.dark.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyLg" style={styles.sheetActionText}>
                Show me as going
              </Text>
              <Text variant="caption" style={styles.sheetCaption}>
                Your name appears on this event&apos;s page. Off by default; change it anytime from
                your ticket.
              </Text>
            </View>
            <Switch
              value={showMe}
              onValueChange={toggleShowMe}
              disabled={showMePending || !rsvpTicketId}
              trackColor={{ false: theme.dark.border, true: palette.coral[600] }}
              thumbColor={palette.warm[50]}
            />
          </View>

          <Pressable style={styles.sheetDone} onPress={() => setCelebrate(false)}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        target={{ eventId: event.id }}
        what="this event"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing[3] },
  errorText: { color: theme.dark.textSecondary, fontSize: fontSize.base, textAlign: 'center' },
  backChip: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: theme.dark.accent,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[5],
  },
  backChipText: { color: theme.dark.accent, fontFamily: 'Alata_400Regular' },

  hero: { width: '100%', backgroundColor: theme.dark.surface, position: 'relative' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: { fontSize: 13, letterSpacing: 1.82 },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(13,10,11,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.28)',
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
  title: { lineHeight: 36 },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3] },
  avatars: { flexDirection: 'row' },
  proofAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A1F21',
    borderWidth: 1,
    borderColor: palette.coral[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofText: { color: palette.warm[300], flexShrink: 1 },
  proofAvatarImg: { width: '100%', height: '100%', borderRadius: 999 },
  proofAvatarInitial: { color: palette.coral[400] },

  // Post-RSVP celebration sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(10,9,7,0.55)' },
  sheet: {
    backgroundColor: theme.dark.surface,
    borderTopLeftRadius: radiusExtra.hero,
    borderTopRightRadius: radiusExtra.hero,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.dark.border,
    marginBottom: spacing[4],
  },
  sheetTitle: { marginTop: spacing[2] },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    alignSelf: 'stretch',
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.dark.borderSubtle,
    marginTop: spacing[2],
  },
  sheetActionText: { color: theme.dark.textPrimary },
  sheetCaption: { color: theme.dark.textSecondary, marginTop: 2, maxWidth: 240 },
  sheetDone: {
    alignSelf: 'stretch',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
    backgroundColor: 'rgba(249,142,128,0.14)',
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[5],
  },
  sheetDoneText: { color: palette.coral[200], fontSize: fontSize.base },
  heart: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(13,10,11,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartActive: { backgroundColor: 'rgba(249,142,128,0.2)' },

  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[5],
  },
  infoCol: { flex: 1 },
  // 0.2em at 10px, per the handoff — tighter and smaller than the shared
  // `monoLabel` default, which is sized for 11px eyebrows.
  infoLabel: { fontSize: 10, letterSpacing: 2, color: palette.warm[550], marginBottom: spacing[1] },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  infoValue: { flexShrink: 1 },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  vDivider: { height: 42, marginHorizontal: spacing[3] },

  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: 14,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  onlineTitle: { color: theme.dark.textPrimary },
  section: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  byLine: { color: theme.dark.textSecondary, fontSize: fontSize.sm, marginBottom: spacing[4] },
  byName: { color: theme.dark.textPrimary },
  sectionTitle: { marginBottom: spacing[2] },
  about: { color: palette.warm[400], lineHeight: 24 },
  topActions: { flexDirection: 'row', gap: spacing[2] },
  gallery: { marginTop: spacing[6], gap: spacing[3] },
  capacity: { marginTop: spacing[4] },

  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  rsvpErr: { color: palette.coral[300], textAlign: 'center', marginBottom: spacing[2] },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingVertical: 17,
    paddingHorizontal: spacing[5],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
  },
  ctaPillDisabled: {
    backgroundColor: 'transparent',
    borderColor: theme.dark.border,
  },
});

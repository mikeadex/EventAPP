import {
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, Link, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, theme, palette, radiusExtra, fontFamily } from '@ekklesia/ui/tokens';
import { Scrim as GradientScrim, scrimPreset } from '@/components/scrim';
import { Text } from '@/components/text';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useForegroundRefresh } from '@/lib/use-foreground-refresh';
import { EmptyState, ErrorState, FadeIn, Skeleton } from '@/components/states';
import { showToast } from '@/components/toast';
import { UserAvatar } from '@/components/user-avatar';

interface EventItem {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  category: string;
  attendeeCount: number;
  coverImageUrl: string | null;
  isFree: boolean;
  venue: { city: string; country: string } | null;
  organization: { slug: string; name: string };
}

interface CityItem {
  city: string;
  country: string;
}

const BAR_CLEARANCE = 110;
const PAD = spacing[5];
const SPOTLIGHT_COUNT = 5;
const HERO_H = 340;
const GAP = spacing[4];
const SPOT_W = 290;
const FEAT_W = 160;

/** Circular save toggle overlaid on a card, with a spring pop on press. */
function HeartButton({
  saved,
  onPress,
  style,
}: {
  saved: boolean;
  onPress: () => void;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    // Pop first so feedback lands even while the network call is in flight.
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, speed: 40, bounciness: 12, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={[styles.heart, saved && styles.heartSaved, style]}
      accessibilityLabel={saved ? 'Unsave event' : 'Save event'}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={saved ? 'heart' : 'heart-outline'}
          size={18}
          color={saved ? color.ink[900] : color.ink[0]}
        />
      </Animated.View>
    </Pressable>
  );
}

function eventHref(item: EventItem) {
  return {
    pathname: '/event/[id]' as const,
    params: { id: item.id, orgSlug: item.organization.slug, eventSlug: item.slug },
  };
}

function prettyCategory(c: string) {
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** Stacked translucent bands → smooth fade without a gradient lib. */
/**
 * The hero's scrim. The old four bands only darkened the foot; the refresh
 * darkens the head too, so the status bar and location pill stay legible on a
 * bright photo, and clears through the middle so the image is not muddied.
 */
function Scrim() {
  return <GradientScrim stops={scrimPreset.hero} />;
}

/** Large landscape card for the "Happening soon" carousel. */
function SpotlightCard({
  item,
  saved,
  onToggleSave,
}: {
  item: EventItem;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const d = new Date(item.startsAt);
  return (
    <Link href={eventHref(item)} asChild>
      <Pressable style={styles.spotlight}>
        {item.coverImageUrl ? (
          <Image source={{ uri: item.coverImageUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Ionicons name="calendar-outline" size={36} color={theme.dark.textMuted} />
          </View>
        )}
        <Scrim />
        <HeartButton saved={saved} onPress={onToggleSave} style={styles.cardHeart} />
        <View style={styles.spotlightTag}>
          <Text variant="overline" style={styles.spotlightTagText}>
            {prettyCategory(item.category)}
          </Text>
        </View>
        <View style={styles.spotlightBody}>
          <Text variant="title" tone="onPhoto" numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.spotlightMeta}>
            <Ionicons name="calendar-outline" size={13} color={palette.warm[300]} />
            <Text variant="label" tone="onPhotoMuted">
              {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Ionicons
              name="time-outline"
              size={13}
              color={palette.warm[300]}
              style={{ marginLeft: spacing[2] }}
            />
            <Text variant="label" tone="onPhotoMuted">
              {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Portrait card for the "Featured" carousel. */
function FeaturedCard({
  item,
  saved,
  onToggleSave,
}: {
  item: EventItem;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const d = new Date(item.startsAt);
  return (
    <Link href={eventHref(item)} asChild>
      <Pressable style={styles.featuredCard}>
        {item.coverImageUrl ? (
          <Image source={{ uri: item.coverImageUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Ionicons name="calendar-outline" size={32} color={theme.dark.textMuted} />
          </View>
        )}
        <Scrim />
        <HeartButton saved={saved} onPress={onToggleSave} style={styles.cardHeartSm} />
        <View style={styles.featuredCardBody}>
          <Text variant="bodyLg" tone="onPhoto" numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.featuredCardMeta}>
            <Ionicons name="calendar-outline" size={12} color={palette.warm[300]} />
            <Text variant="caption" tone="onPhotoMuted">
              {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ·{' '}
              {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [heroVisible, setHeroVisible] = useState(true);
  const [focused, setFocused] = useState(true);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  // Drive the status bar light only while Discover is focused and the dark hero
  // is still under the notch; dark once scrolled past (or on other tabs).
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Which events the signed-in user has saved (for the card hearts).
  useEffect(() => {
    if (!session?.user) {
      setSavedIds(new Set());
      return;
    }
    let cancelled = false;
    api<{ event: { id: string } }[]>('/v1/me/saved-events')
      .then((list) => {
        if (!cancelled) setSavedIds(new Set(list.map((s) => s.event.id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const toggleSave = useCallback(
    (id: string) => {
      if (!session?.user) {
        router.push('/auth/sign-in');
        return;
      }
      const wasSaved = savedIds.has(id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });
      showToast(wasSaved ? 'Removed from Saved' : 'Saved for later', wasSaved ? undefined : 'heart');
      api(`/v1/me/saved-events/${id}`, { method: wasSaved ? 'DELETE' : 'POST' }).catch(() => {
        // revert on failure
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
        showToast("Couldn't update Saved — check your connection");
      });
    },
    [session?.user, savedIds],
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '30' });
        params.set('startsAfter', new Date().toISOString());
        if (city) params.set('city', city);
        const d = await api<{ items: EventItem[] }>(`/v1/events?${params.toString()}`);
        setItems(d.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load events');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [city],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  // Coming back to the app after a while re-fetches, so a list that failed or
  // went stale while the phone was asleep recovers on its own.
  useForegroundRefresh(() => void load('refresh'));

  // Cities with upcoming events, for the location picker.
  useEffect(() => {
    api<{ items: CityItem[] }>('/v1/events/cities')
      .then((d) => setCities(d.items))
      .catch(() => {});
  }, []);

  const upcomingItems = useMemo(() => {
    const now = Date.now();
    return items.filter((e) => new Date(e.startsAt).getTime() > now);
  }, [items]);

  const heroEvent = upcomingItems[0] ?? null;
  const happeningSoon = upcomingItems.slice(1, 1 + SPOTLIGHT_COUNT);
  const featuredList = upcomingItems.slice(1 + SPOTLIGHT_COUNT);

  const initial = (session?.user?.name ?? session?.user?.email ?? '?').charAt(0).toUpperCase();

  const locationPill = (
    <Pressable style={styles.locationPill} onPress={() => setCityPickerOpen(true)} hitSlop={6}>
      <Ionicons name="location" size={15} color={palette.coral[300]} />
      <Text variant="footnote" tone="onPhoto">
        {city ?? 'All locations'}
      </Text>
      <Ionicons name="chevron-down" size={14} color={palette.warm[300]} />
    </Pressable>
  );

  const cityPicker = (
    <Modal
      visible={cityPickerOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setCityPickerOpen(false)}
    >
      <Pressable style={styles.sheetOverlay} onPress={() => setCityPickerOpen(false)} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[4] }]}>
        <View style={styles.sheetHandle} />
        <Text variant="heading" style={styles.sheetTitle}>
          Location
        </Text>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setCity(null);
            setCityPickerOpen(false);
          }}
        >
          <Ionicons name="globe-outline" size={20} color={theme.dark.textSecondary} />
          <Text variant="bodyLg" style={styles.sheetRowText}>
            All locations
          </Text>
          {city === null ? (
            <Ionicons name="checkmark" size={20} color={theme.dark.accent} />
          ) : null}
        </Pressable>
        {cities.map((c) => {
          const active = city === c.city;
          return (
            <Pressable
              key={`${c.city}-${c.country}`}
              style={styles.sheetRow}
              onPress={() => {
                setCity(c.city);
                setCityPickerOpen(false);
              }}
            >
              <Ionicons name="location-outline" size={20} color={theme.dark.textSecondary} />
              <Text variant="bodyLg" style={styles.sheetRowText}>
                {c.city}
                <Text variant="caption" tone="muted">
                  {'  '}
                  {c.country}
                </Text>
              </Text>
              {active ? <Ionicons name="checkmark" size={20} color={theme.dark.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );

  const hero = heroEvent ? (
    <Link href={eventHref(heroEvent)} asChild>
      <Pressable style={styles.hero}>
        {heroEvent.coverImageUrl ? (
          <Image source={{ uri: heroEvent.coverImageUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Ionicons name="calendar-outline" size={44} color={theme.dark.textMuted} />
          </View>
        )}
        <Scrim />
        <View style={[styles.heroTopBar, { paddingTop: insets.top + spacing[1] }]}>
          {locationPill}
          <Pressable style={styles.heroAvatar} onPress={() => router.push('/profile')} hitSlop={6}>
            <UserAvatar
              uri={session?.user?.image}
              initial={session?.user ? initial : null}
              size={42}
              textStyle={styles.heroAvatarText}
              signedOutColor={color.ink[0]}
              style={styles.avatarFill}
            />
          </Pressable>
        </View>
        <View style={styles.heroBody}>
          <View style={styles.heroTag}>
            <Text variant="overline" tone="accent">
              {prettyCategory(heroEvent.category)}
            </Text>
          </View>
          <Text variant="hero" tone="onPhoto" numberOfLines={2}>
            {heroEvent.title}
          </Text>
          <View style={styles.heroMeta}>
            <Ionicons name="business" size={13} color={palette.warm[300]} />
            <Text variant="footnote" tone="onPhotoMuted" numberOfLines={1}>
              {heroEvent.organization.name}
            </Text>
            {heroEvent.attendeeCount > 0 ? (
              <>
                <View style={styles.heroDot} />
                <Text variant="footnote" tone="onPhotoMuted">
                  {heroEvent.attendeeCount} going
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <HeartButton
          saved={savedIds.has(heroEvent.id)}
          onPress={() => toggleSave(heroEvent.id)}
          style={styles.heroHeart}
        />
      </Pressable>
    </Link>
  ) : (
    <View style={[styles.plainTop, { paddingTop: insets.top + spacing[2] }]}>
      {locationPill}
      <Pressable style={styles.avatar} onPress={() => router.push('/profile')}>
        <UserAvatar
          uri={session?.user?.image}
          initial={session?.user ? initial : null}
          size={42}
          textStyle={styles.avatarText}
          style={styles.avatarFill}
        />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style={focused && heroVisible && heroEvent ? 'light' : 'dark'} />
      {cityPicker}
      {loading ? (
        <View>
          <Skeleton style={styles.skelHero} />
          <View style={styles.content}>
            <Skeleton style={styles.skelSearch} />
            <Skeleton style={styles.skelSectionRow} />
            <View style={styles.skelRow}>
              <Skeleton style={styles.skelCardL} />
              <Skeleton style={styles.skelCardL} />
            </View>
          </View>
        </View>
      ) : error && items.length === 0 ? (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <ErrorState message={error} onRetry={() => load('initial')} />
        </View>
      ) : (
        <FadeIn>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: BAR_CLEARANCE }}
          scrollEventThrottle={16}
          onScroll={(e) =>
            setHeroVisible(e.nativeEvent.contentOffset.y < HERO_H - insets.top - 56)
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={theme.dark.accent}
              colors={[theme.dark.accent]}
              progressViewOffset={insets.top}
            />
          }
        >
          {hero}

          <View style={styles.content}>
            {/* Tapping opens the full-screen search (with filters). */}
            <Pressable style={styles.searchTrigger} onPress={() => router.push('/search')}>
              <Ionicons name="search" size={18} color={theme.dark.textMuted} />
              <Text variant="body" tone="muted" style={styles.searchTriggerText}>
                Search for events…
              </Text>
              <Ionicons name="options-outline" size={18} color={theme.dark.textMuted} />
            </Pressable>

            {happeningSoon.length > 0 ? (
              <>
                <View style={styles.sectionRow}>
                  <Text variant="heading">Happening soon</Text>
                  <Pressable onPress={() => router.push('/search')} hitSlop={6}>
                    <Text variant="footnote" tone="accent">See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}
                  style={styles.carouselScroll}
                  snapToInterval={SPOT_W + GAP}
                  snapToAlignment="start"
                  decelerationRate="fast"
                >
                  {happeningSoon.map((e) => (
                    <SpotlightCard
                      key={e.id}
                      item={e}
                      saved={savedIds.has(e.id)}
                      onToggleSave={() => toggleSave(e.id)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {featuredList.length > 0 ? (
              <>
                <View style={styles.sectionRow}>
                  <Text variant="heading">Featured</Text>
                  <Pressable onPress={() => router.push('/search')} hitSlop={6}>
                    <Text variant="footnote" tone="accent">See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}
                  style={styles.carouselScroll}
                  snapToInterval={FEAT_W + GAP}
                  snapToAlignment="start"
                  decelerationRate="fast"
                >
                  {featuredList.map((e) => (
                    <FeaturedCard
                      key={e.id}
                      item={e}
                      saved={savedIds.has(e.id)}
                      onToggleSave={() => toggleSave(e.id)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {!heroEvent ? (
              <EmptyState
                icon="compass-outline"
                title={city ? `Nothing in ${city} yet` : 'No events yet'}
                message={
                  city
                    ? 'Try another location — new gatherings are added all the time.'
                    : 'Check back soon — new gatherings are added all the time.'
                }
              />
            ) : null}
          </View>
        </ScrollView>
        </FadeIn>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  content: { paddingHorizontal: PAD, paddingTop: spacing[5] },

  // Full-bleed hero — height in the StyleSheet (inline height is dropped by
  // Link asChild's style merge). ~28% of a typical screen.
  hero: {
    width: '100%',
    height: HERO_H,
    backgroundColor: theme.dark.surface,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heart: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(20,20,20,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartSaved: { backgroundColor: color.ink[0] },
  cardHeart: { position: 'absolute', top: spacing[3], right: spacing[3] },
  cardHeartSm: { position: 'absolute', top: spacing[2], right: spacing[2], width: 30, height: 30, borderRadius: 15 },
  heroHeart: { position: 'absolute', right: PAD, bottom: PAD, width: 44, height: 44, borderRadius: 22 },
  // Loading skeleton (matches the hero + carousel layout)
  skelHero: { width: '100%', height: HERO_H, backgroundColor: theme.dark.surface, borderRadius: 0 },
  skelSearch: { height: 52, borderRadius: radius.full, backgroundColor: theme.dark.surface },
  skelSectionRow: {
    height: 22,
    width: 150,
    borderRadius: radius.sm,
    backgroundColor: theme.dark.surface,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  skelRow: { flexDirection: 'row', gap: GAP },
  skelCardL: {
    width: SPOT_W,
    height: 178,
    borderRadius: 20,
    backgroundColor: theme.dark.surface,
  },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.dark.surfaceRaised },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: PAD,
    right: PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(20,20,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { fontFamily: fontFamily.body, fontSize: 16, color: palette.warm[0] },
  heroBody: { padding: PAD, paddingRight: 64 },
  // Outlined, not filled: the refresh states actions and tags are a 1px
  // accent line on transparent rather than a flood of colour.
  heroTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.45)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.full,
    marginBottom: spacing[3],
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: spacing[2] },
  // A coral dot replaces the old middot character — the handoff uses a 3px
  // round separator, which a glyph cannot match across platforms.
  heroDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.coral[400],
  },

  plainTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginBottom: spacing[2],
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(13,10,11,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.28)',
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: radius.full,
  },

  // Location picker bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(13,10,11,0.62)' },
  sheet: {
    backgroundColor: theme.dark.surface,
    borderTopLeftRadius: radiusExtra.hero,
    borderTopRightRadius: radiusExtra.hero,
    paddingHorizontal: PAD,
    paddingTop: spacing[3],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.dark.border,
    marginBottom: spacing[4],
  },
  sheetTitle: { marginBottom: spacing[2] },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.dark.borderSubtle,
  },
  sheetRowText: { flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.dark.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.body, fontSize: 16, color: theme.dark.textPrimary },
  avatarFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  searchTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.16)',
    borderRadius: radius.full,
    paddingHorizontal: 18,
    height: 52,
  },
  searchTriggerText: { flex: 1 },


  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },

  carouselScroll: { marginHorizontal: -PAD },
  carousel: { paddingHorizontal: PAD, gap: spacing[4] },
  spotlight: {
    width: 290,
    height: 178,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.dark.surface,
    justifyContent: 'flex-end',
  },
  spotlightTag: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,227,222,0.4)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  spotlightTagText: { color: '#FFE3DE', letterSpacing: 1.98 },
  spotlightBody: { padding: spacing[4] },
  spotlightMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 },

  // Portrait "Featured" card
  featuredCard: {
    width: 160,
    height: 224,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: theme.dark.surface,
    justifyContent: 'flex-end',
  },
  featuredCardBody: { padding: spacing[3] },
  featuredCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },

});

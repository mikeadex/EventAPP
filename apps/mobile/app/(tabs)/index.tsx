import {
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, Link, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  color,
  spacing,
  radius,
  fontSize,
  fontWeight,
  theme,
  palette,
  fontFamily,
  radiusExtra,
} from '@ekklesia/ui/tokens';
import { Scrim as GradientScrim, scrimPreset } from '@/components/scrim';
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
            <Ionicons name="calendar-outline" size={36} color={color.ink[600]} />
          </View>
        )}
        <Scrim />
        <HeartButton saved={saved} onPress={onToggleSave} style={styles.cardHeart} />
        <View style={styles.spotlightTag}>
          <Text style={styles.spotlightTagText}>{prettyCategory(item.category)}</Text>
        </View>
        <View style={styles.spotlightBody}>
          <Text style={styles.spotlightTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.spotlightMeta}>
            <Ionicons name="calendar-outline" size={13} color={color.ink[200]} />
            <Text style={styles.spotlightMetaText}>
              {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <Ionicons
              name="time-outline"
              size={13}
              color={color.ink[200]}
              style={{ marginLeft: spacing[2] }}
            />
            <Text style={styles.spotlightMetaText}>
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
            <Ionicons name="calendar-outline" size={32} color={color.ink[600]} />
          </View>
        )}
        <Scrim />
        <HeartButton saved={saved} onPress={onToggleSave} style={styles.cardHeartSm} />
        <View style={styles.featuredCardBody}>
          <Text style={styles.featuredCardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.featuredCardMeta}>
            <Ionicons name="calendar-outline" size={12} color={color.ink[200]} />
            <Text style={styles.featuredCardMetaText}>
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
      <Ionicons name="location" size={15} color={color.ink[0]} />
      <Text style={styles.locationText}>{city ?? 'All locations'}</Text>
      <Ionicons name="chevron-down" size={14} color={color.ink[300]} />
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
        <Text style={styles.sheetTitle}>Location</Text>
        <Pressable
          style={styles.sheetRow}
          onPress={() => {
            setCity(null);
            setCityPickerOpen(false);
          }}
        >
          <Ionicons name="globe-outline" size={20} color={color.ink[700]} />
          <Text style={styles.sheetRowText}>All locations</Text>
          {city === null ? (
            <Ionicons name="checkmark" size={20} color={color.ink[900]} />
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
              <Ionicons name="location-outline" size={20} color={color.ink[700]} />
              <Text style={styles.sheetRowText}>
                {c.city}
                <Text style={styles.sheetRowSub}>  {c.country}</Text>
              </Text>
              {active ? <Ionicons name="checkmark" size={20} color={color.ink[900]} /> : null}
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
            <Ionicons name="calendar-outline" size={44} color={color.ink[600]} />
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
            <Text style={styles.heroTagText}>{prettyCategory(heroEvent.category)}</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {heroEvent.title}
          </Text>
          <View style={styles.heroMeta}>
            <Ionicons name="business" size={13} color={color.ink[200]} />
            <Text style={styles.heroMetaText} numberOfLines={1}>
              {heroEvent.organization.name}
            </Text>
            {heroEvent.attendeeCount > 0 ? (
              <>
                <View style={styles.heroDot} />
                <Text style={styles.heroMetaText}>{heroEvent.attendeeCount} going</Text>
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
              tintColor={color.ink[900]}
              colors={[color.ink[900]]}
              progressViewOffset={insets.top}
            />
          }
        >
          {hero}

          <View style={styles.content}>
            {/* Tapping opens the full-screen search (with filters). */}
            <Pressable style={styles.searchTrigger} onPress={() => router.push('/search')}>
              <Ionicons name="search" size={18} color={color.ink[400]} />
              <Text style={styles.searchTriggerText}>Search for events…</Text>
              <Ionicons name="options-outline" size={18} color={color.ink[400]} />
            </Pressable>

            {happeningSoon.length > 0 ? (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>Happening soon</Text>
                  <Pressable onPress={() => router.push('/search')} hitSlop={6}>
                    <Text style={styles.seeAll}>See all</Text>
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
                  <Text style={styles.sectionLabel}>Featured</Text>
                  <Pressable onPress={() => router.push('/search')} hitSlop={6}>
                    <Text style={styles.seeAll}>See all</Text>
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
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
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
  skelHero: { width: '100%', height: HERO_H, backgroundColor: color.ink[100], borderRadius: 0 },
  skelSearch: { height: 52, borderRadius: radius.full, backgroundColor: color.ink[100] },
  skelSectionRow: {
    height: 22,
    width: 150,
    borderRadius: radius.sm,
    backgroundColor: color.ink[100],
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  skelRow: { flexDirection: 'row', gap: GAP },
  skelCardL: {
    width: SPOT_W,
    height: 210,
    borderRadius: radius['2xl'],
    backgroundColor: color.ink[100],
  },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  scrimBand: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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
  heroAvatarText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: color.ink[0] },
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
  heroTagText: {
    color: palette.coral[400],
    fontFamily: fontFamily.body,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#F7F5F4',
    fontFamily: fontFamily.body,
    fontSize: 34,
    lineHeight: 36,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: spacing[2] },
  heroMetaText: { color: palette.warm[300], fontFamily: fontFamily.body, fontSize: fontSize.sm },
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
  locationText: { color: color.ink[0], fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Location picker bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(10,9,7,0.5)' },
  sheet: {
    backgroundColor: color.ink[0],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: PAD,
    paddingTop: spacing[3],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.ink[200],
    marginBottom: spacing[4],
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: color.ink[900],
    marginBottom: spacing[2],
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.ink[100],
  },
  sheetRowText: {
    flex: 1,
    fontSize: fontSize.base,
    color: color.ink[900],
    fontWeight: fontWeight.medium,
  },
  sheetRowSub: { color: color.ink[400], fontSize: fontSize.xs, fontWeight: fontWeight.regular },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: color.ink[900] },
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
  searchTriggerText: {
    flex: 1,
    color: theme.dark.textMuted,
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  seeAll: { color: palette.coral[400], fontFamily: fontFamily.body, fontSize: fontSize.sm },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  searchCollapsed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: color.ink[50],
    borderWidth: 1,
    borderColor: color.ink[100],
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    height: 50,
  },
  searchOpen: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: color.ink[50],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    height: 50,
  },
  searchPlaceholder: { color: color.ink[500], fontSize: fontSize.base },
  searchInput: { flex: 1, fontSize: fontSize.base, color: color.ink[900] },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: color.ink[200],
    backgroundColor: color.ink[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: color.ink[900], borderColor: color.ink[900] },
  filterDot: {
    position: 'absolute',
    top: 11,
    right: 13,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color.ink[0],
  },

  chipsScroll: { marginTop: spacing[4], marginHorizontal: -PAD },
  chips: { paddingHorizontal: PAD, gap: spacing[2] },
  chip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.ink[200],
    backgroundColor: color.ink[0],
  },
  chipActive: { backgroundColor: color.ink[900], borderColor: color.ink[900] },
  chipText: { fontSize: fontSize.sm, color: color.ink[600], fontWeight: fontWeight.medium },
  chipTextActive: { color: color.ink[0] },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  sectionLabel: {
    fontFamily: fontFamily.body,
    fontSize: 20,
    color: theme.dark.textPrimary,
  },
  sectionCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: color.ink[400],
    backgroundColor: color.ink[100],
    borderRadius: radius.full,
    minWidth: 24,
    textAlign: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    overflow: 'hidden',
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
  spotlightTagText: {
    color: '#FFE3DE',
    fontFamily: fontFamily.body,
    fontSize: 11,
    letterSpacing: 1.98,
    textTransform: 'uppercase',
  },
  spotlightBody: { padding: spacing[4] },
  spotlightTitle: {
    color: '#F7F5F4',
    fontFamily: fontFamily.body,
    fontSize: 21,
    lineHeight: 26,
  },
  spotlightMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 7 },
  spotlightMetaText: { color: palette.warm[300], fontFamily: fontFamily.body, fontSize: 13 },

  // Portrait "Featured" card
  featuredCard: {
    width: 160,
    height: 224,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: color.ink[800],
    justifyContent: 'flex-end',
  },
  featuredCardBody: { padding: spacing[3] },
  featuredCardTitle: {
    color: color.ink[0],
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  featuredCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  featuredCardMetaText: { color: color.ink[200], fontSize: 11, fontWeight: fontWeight.medium },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: PAD,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowCat: {
    fontSize: 11,
    color: color.ink[400],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: fontWeight.semibold,
    marginBottom: 2,
  },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.ink[900] },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[1] },
  rowMetaText: { fontSize: fontSize.xs, color: color.ink[500] },
});

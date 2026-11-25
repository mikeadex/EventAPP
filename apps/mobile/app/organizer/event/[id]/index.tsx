import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { locationMode } from '@/lib/event-location';
import { ErrorState } from '@/components/states';
import { showToast } from '@/components/toast';
import {
  EventForm,
  emptyEventForm,
  splitInstant,
  toEventBody,
  validateEventForm,
  type EventFormValues,
} from '@/components/organizer/event-form';

interface TicketType {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  quantity: number;
  sold: number;
}

interface EventDetail {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  status: string;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number | null;
  coverImageUrl: string | null;
  attendeeCount: number;
  venue: { name: string; addressLine1: string; city: string; postalCode: string } | null;
  ticketTypes: TicketType[];
}

function money(minor: number, currency: string) {
  if (minor === 0) return 'Free';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export default function OrganizerEventScreen() {
  const { id, orgId } = useLocalSearchParams<{ id: string; orgId?: string }>();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<EventFormValues>(emptyEventForm());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [ttName, setTtName] = useState('');
  const [ttPrice, setTtPrice] = useState('0');
  const [ttQty, setTtQty] = useState('100');
  const [ttOpen, setTtOpen] = useState(false);

  const hydrate = useCallback((e: EventDetail) => {
    setEvent(e);
    const start = splitInstant(e.startsAt);
    const end = splitInstant(e.endsAt);
    setForm({
      title: e.title,
      summary: e.summary ?? '',
      description: e.description ?? '',
      category: e.category.toLowerCase(),
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      // Editing never changes whether an event repeats; the form hides the
      // control and these just satisfy the shape.
      repeat: 'once',
      repeatCount: '',
      locationMode: locationMode(e),
      onlineUrl: e.onlineUrl ?? '',
      venueName: e.venue?.name ?? '',
      addressLine1: e.venue?.addressLine1 ?? '',
      city: e.venue?.city ?? '',
      postalCode: e.venue?.postalCode ?? '',
      capacity: e.capacity === null ? '' : String(e.capacity),
      // Must be hydrated, not defaulted: the form sends every field back on
      // save, so an empty value here would clear a cover the organiser set
      // from the gallery screen simply by opening the editor and saving.
      coverImageUrl: e.coverImageUrl ?? null,
    });
  }, []);

  const load = useCallback(async () => {
    try {
      hydrate(await api<EventDetail>(`/v1/events/${id}`));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load this event');
    }
  }, [id, hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const problem = validateEventForm(form);
    if (problem) {
      showToast(problem);
      return;
    }
    setPending(true);
    try {
      await api(`/v1/events/${id}`, { method: 'PATCH', body: toEventBody(form, 'update') });
      showToast('Changes saved', 'checkmark-circle');
      await load();
    } catch (e) {
      showToast(describeApiError(e, "Couldn't save changes"));
    } finally {
      setPending(false);
    }
  }

  async function transition(action: 'publish' | 'cancel') {
    const run = async () => {
      setPending(true);
      try {
        await api(`/v1/events/${id}/${action}`, { method: 'POST', body: {} });
        showToast(action === 'publish' ? 'Event published' : 'Event cancelled');
        await load();
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'That did not work');
      } finally {
        setPending(false);
      }
    };
    if (action === 'cancel') {
      Alert.alert(
        'Cancel this event?',
        'It closes to new registrations. Existing tickets stay valid.',
        [
          { text: 'Keep it', style: 'cancel' },
          { text: 'Cancel event', style: 'destructive', onPress: () => void run() },
        ],
      );
      return;
    }
    await run();
  }

  async function addTicketType() {
    const price = Number(ttPrice);
    const qty = Number(ttQty);
    if (!ttName.trim()) return showToast('Give the ticket a name');
    if (!Number.isFinite(price) || price < 0) return showToast('Price must be 0 or more');
    if (!Number.isInteger(qty) || qty < 1) return showToast('Quantity must be at least 1');
    setPending(true);
    try {
      await api(`/v1/events/${id}/ticket-types`, {
        method: 'POST',
        body: {
          name: ttName.trim(),
          // Pounds on screen, pence over the wire — rounded, since 12.50 * 100
          // is not exactly 1250 in binary floating point.
          priceMinor: Math.round(price * 100),
          currency: 'GBP',
          quantity: qty,
        },
      });
      setTtName('');
      setTtPrice('0');
      setTtQty('100');
      setTtOpen(false);
      showToast('Ticket type added');
      await load();
    } catch (e) {
      showToast(describeApiError(e, "Couldn't add that ticket type"));
    } finally {
      setPending(false);
    }
  }

  async function removeTicketType(t: TicketType) {
    setPending(true);
    try {
      await api(`/v1/events/${id}/ticket-types/${t.id}`, { method: 'DELETE' });
      showToast('Ticket type removed');
      await load();
    } catch (e) {
      showToast(describeApiError(e, "Couldn't remove that ticket type"));
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
        <ErrorState message={loadError} onRetry={() => void load()} />
      </View>
    );
  }
  if (!event) {
    return (
      <View style={[styles.c, styles.center]}>
        <ActivityIndicator color={theme.dark.textPrimary} />
      </View>
    );
  }

  const cancelled = event.status === 'CANCELLED';

  return (
    <KeyboardAvoidingView
      style={[styles.c, { paddingTop: insets.top + spacing[2] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text style={styles.h}>{event.status.toLowerCase()}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: insets.bottom + spacing[10],
          gap: spacing[5],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.attendeesBtn}
          onPress={() => router.push(`/organizer/event/${id}/attendees`)}
        >
          <Ionicons name="people-outline" size={18} color={palette.coral[200]} />
          <Text style={styles.attendeesText}>{event.attendeeCount} going · check people in</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.coral[200]} />
        </Pressable>

        <Pressable
          style={styles.announceBtn}
          onPress={() => router.push(`/organizer/event/${id}/media`)}
        >
          <Ionicons name="images-outline" size={18} color={theme.dark.textPrimary} />
          <Text style={styles.announceText}>Photos and video</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.dark.textMuted} />
        </Pressable>

        <Pressable
          style={styles.announceBtn}
          onPress={() => router.push(`/organizer/event/${id}/announce`)}
        >
          <Ionicons name="megaphone-outline" size={18} color={theme.dark.textPrimary} />
          <Text style={styles.announceText}>Message attendees</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.dark.textMuted} />
        </Pressable>

        {cancelled ? (
          <Text style={styles.notice}>This event is cancelled and can no longer be edited.</Text>
        ) : null}

        <EventForm value={form} onChange={setForm} disabled={cancelled || pending} />

        {!cancelled && (
          <Pressable
            style={[styles.primaryBtn, pending && { opacity: 0.6 }]}
            disabled={pending}
            onPress={() => void save()}
          >
            <Text style={styles.primaryBtnText}>{pending ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        )}

        {/* ─── Tickets ─── */}
        <View style={styles.divider} />
        <View>
          <Text style={styles.sectionTitle}>Tickets</Text>
          <Text style={styles.sectionHint}>
            With no ticket types this event takes free RSVPs. Add a priced type to sell tickets.
          </Text>

          <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
            {event.ticketTypes.map((t) => (
              <View key={t.id} style={styles.ttRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ttName}>{t.name}</Text>
                  <Text style={styles.ttSub}>
                    {money(t.priceMinor, t.currency)} · {t.sold}/{t.quantity} issued
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  disabled={cancelled || pending || t.sold > 0}
                  onPress={() => void removeTicketType(t)}
                  style={{ opacity: t.sold > 0 ? 0.3 : 1 }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.dark.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>

          {ttOpen ? (
            <View style={styles.ttForm}>
              <TextInput
                value={ttName}
                onChangeText={setTtName}
                placeholder="Name (e.g. Standard)"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
              />
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <TextInput
                  value={ttPrice}
                  onChangeText={setTtPrice}
                  placeholder="Price"
                  placeholderTextColor={theme.dark.textMuted}
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  value={ttQty}
                  onChangeText={setTtQty}
                  placeholder="Quantity"
                  placeholderTextColor={theme.dark.textMuted}
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <Pressable
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => setTtOpen(false)}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, { flex: 1 }, pending && { opacity: 0.6 }]}
                  disabled={pending}
                  onPress={() => void addTicketType()}
                >
                  <Text style={styles.primaryBtnText}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            !cancelled && (
              <Pressable style={styles.secondaryBtn} onPress={() => setTtOpen(true)}>
                <Text style={styles.secondaryBtnText}>Add ticket type</Text>
              </Pressable>
            )
          )}
        </View>

        {/* ─── Status ─── */}
        {!cancelled && (
          <>
            <View style={styles.divider} />
            {event.status === 'DRAFT' ? (
              <Pressable
                style={[styles.primaryBtn, pending && { opacity: 0.6 }]}
                disabled={pending}
                onPress={() => void transition('publish')}
              >
                <Text style={styles.primaryBtnText}>Publish event</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.secondaryBtn}
                disabled={pending}
                onPress={() => void transition('cancel')}
              >
                <Text style={styles.secondaryBtnText}>Cancel event</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  h: {
    fontSize: fontSize.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.dark.textSecondary,
  },
  announceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    padding: spacing[4],
  },
  announceText: { flex: 1, fontSize: fontSize.base, color: theme.dark.textPrimary },
  attendeesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  attendeesText: { flex: 1, color: palette.coral[200] },
  notice: {
    padding: spacing[4],
    borderRadius: radius.md,
    backgroundColor: theme.dark.surface,
    color: theme.dark.textSecondary,
    fontSize: fontSize.sm,
  },
  divider: { height: 1, backgroundColor: theme.dark.surfaceRaised },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },
  sectionHint: { fontSize: fontSize.sm, color: theme.dark.textSecondary, marginTop: 4 },
  ttRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: theme.dark.borderSubtle,
    borderRadius: radius.md,
  },
  ttName: {
    fontSize: fontSize.base,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },
  ttSub: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  ttForm: { gap: spacing[3], marginTop: spacing[3] },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: theme.dark.textPrimary,
  },
  primaryBtn: {
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnText: {
    color: palette.coral[200],
    fontFamily: 'Alata_400Regular',
    fontSize: fontSize.base,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[3],
  },
  secondaryBtnText: {
    color: theme.dark.textPrimary,
    fontFamily: 'Alata_400Regular',
    fontSize: fontSize.base,
  },
});

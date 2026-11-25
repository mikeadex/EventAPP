import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { REPEAT_MAX_COUNT, REPEAT_MIN_COUNT, seriesOccurrences, type RepeatEvery } from '@ekklesia/shared';
import { DateField, TimeField } from './date-time-fields';
import { CoverPhotoField } from './cover-photo-field';
import type { LocationMode } from '@/lib/event-location';

/** How a new event repeats. Create only — each date is its own event once saved. */
export type RepeatChoice = 'none' | RepeatEvery;

const REPEAT_OPTIONS: { value: RepeatChoice; label: string; hint: string }[] = [
  { value: 'none', label: 'Does not repeat', hint: 'A one-off. You can always create another.' },
  { value: 'week', label: 'Weekly', hint: 'Same day and time every week.' },
  {
    value: 'month',
    label: 'Monthly',
    hint: 'Same day of the month, every month. The 31st falls on the last day of shorter months.',
  },
];

const LOCATION_MODES = [
  {
    value: 'in_person' as const,
    label: 'In person',
    icon: 'location-outline' as const,
    hint: 'People come to a venue.',
  },
  {
    value: 'online' as const,
    label: 'Online',
    icon: 'videocam-outline' as const,
    hint: 'Streamed only — no venue.',
  },
  {
    value: 'hybrid' as const,
    label: 'Both',
    icon: 'globe-outline' as const,
    hint: 'People can come along or watch the stream.',
  },
];

const CATEGORIES = [
  'service', 'worship', 'prayer', 'youth', 'kids', 'small_group',
  'conference', 'outreach', 'social', 'fundraiser', 'class', 'other',
] as const;

export interface EventFormValues {
  title: string;
  summary: string;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  locationMode: LocationMode;
  onlineUrl: string;
  venueName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  capacity: string;
  /** Public URL of an already-uploaded image, or null for no cover. */
  coverImageUrl: string | null;
  repeat: RepeatChoice;
  /** Dates in all, the first included; a string because it is typed. */
  repeatCount: string;
}

export function emptyEventForm(): EventFormValues {
  return {
    title: '',
    summary: '',
    description: '',
    category: 'service',
    date: '',
    startTime: '',
    endTime: '',
    locationMode: 'in_person',
    onlineUrl: '',
    venueName: '',
    addressLine1: '',
    city: '',
    postalCode: '',
    capacity: '',
    coverImageUrl: null,
    repeat: 'none',
    repeatCount: '6',
  };
}

/** Splits an ISO instant into the local date and time strings the fields use. */
export function splitInstant(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/**
 * Builds an instant from the local date/time fields. Constructing from parts
 * rather than parsing a joined string keeps it in the device's own timezone —
 * `new Date('2026-08-02T19:00')` is parsed inconsistently across engines.
 */
export function toInstant(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!dm || !tm) return null;
  const [, y, mo, d] = dm;
  const [, h, mi] = tm;
  const hour = Number(h);
  const minute = Number(mi);
  if (hour > 23 || minute > 59) return null;
  const out = new Date(Number(y), Number(mo) - 1, Number(d), hour, minute, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** Returns a human-readable problem, or null when the form can be submitted. */
export function validateEventForm(v: EventFormValues): string | null {
  if (v.title.trim().length < 3) return 'Give the event a title of at least 3 characters.';
  const start = toInstant(v.date, v.startTime);
  if (!start) return 'Choose the date and start time.';
  const end = toInstant(v.date, v.endTime);
  if (!end) return 'Choose the end time.';
  if (end <= start) return 'The end time must be after the start time.';
  // A hybrid event needs both halves; the other two need one each.
  if (v.locationMode !== 'in_person') {
    if (!/^https?:\/\//i.test(v.onlineUrl.trim())) return 'Enter the stream link, starting with https://';
  }
  if (v.locationMode !== 'online') {
    if (!v.venueName.trim()) return 'Enter the venue name.';
    if (!v.addressLine1.trim()) return 'Enter the venue address.';
    if (!v.city.trim()) return 'Enter the town or city.';
  }
  if (v.capacity.trim() && !/^\d+$/.test(v.capacity.trim())) return 'Capacity must be a whole number.';
  if (v.repeat !== 'none') {
    const n = Number(v.repeatCount.trim());
    if (!Number.isInteger(n) || n < REPEAT_MIN_COUNT || n > REPEAT_MAX_COUNT) {
      return `Choose between ${REPEAT_MIN_COUNT} and ${REPEAT_MAX_COUNT} dates.`;
    }
  }
  return null;
}

/** The repeat rule the API takes, or undefined when the event does not repeat. */
export function formRepeat(v: EventFormValues) {
  if (v.repeat === 'none') return undefined;
  return { every: v.repeat, count: Number(v.repeatCount.trim()) };
}

/**
 * The device timezone, falling back to UTC. The API requires a non-empty IANA
 * name, and Intl support in Hermes has historically been partial — a missing
 * value here would fail validation rather than degrade.
 */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Shapes the form into the JSON body the API expects.
 *
 * The two endpoints differ in a way that is easy to miss: on update the unused
 * fields are nullable, so `null` clears them, but on create they are merely
 * optional and `null` is rejected outright. So create omits what does not
 * apply, while update sends null to mean "remove this".
 */
export function toEventBody(v: EventFormValues, mode: 'create' | 'update') {
  const start = toInstant(v.date, v.startTime)!;
  const end = toInstant(v.date, v.endTime)!;
  const absent = mode === 'create' ? undefined : null;

  const venue = {
    name: v.venueName.trim(),
    addressLine1: v.addressLine1.trim(),
    city: v.city.trim(),
    postalCode: v.postalCode.trim(),
    country: 'GB',
  };
  const capacity = v.capacity.trim() ? Number(v.capacity.trim()) : absent;

  return {
    title: v.title.trim(),
    summary: v.summary.trim() || undefined,
    description: v.description.trim() || undefined,
    category: v.category,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    timezone: deviceTimezone(),
    // `isOnline` means "has an online component", so it is true for hybrid too;
    // what distinguishes hybrid is that the venue is sent as well.
    isOnline: v.locationMode !== 'in_person',
    onlineUrl: v.locationMode === 'in_person' ? absent : v.onlineUrl.trim(),
    capacity,
    venue: v.locationMode === 'online' ? absent : venue,
    // On create the schema takes a URL or nothing; on update, null is how a
    // cover is cleared, so `absent` carries the right meaning for each.
    coverImageUrl: v.coverImageUrl ?? absent,
    // Only on create: a series is a set of dates to generate, not a property
    // an existing date can change.
    ...(mode === 'create' && { repeat: formRepeat(v) }),
  };
}

export function EventForm({
  value,
  onChange,
  disabled,
  mode = 'update',
}: {
  value: EventFormValues;
  onChange: (next: EventFormValues) => void;
  disabled?: boolean;
  /** `create` shows the Repeats control; an existing date cannot be made to repeat. */
  mode?: 'create' | 'update';
}) {
  const set = <K extends keyof EventFormValues>(key: K, v: EventFormValues[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <View style={{ gap: spacing[4] }}>
      {/* First, not last. The picture is the thing the feed is built around,
          and asking for it after the venue and the times reads as an
          afterthought — which is how it has been treated so far. */}
      <CoverPhotoField
        value={value.coverImageUrl}
        onChange={(url) => set('coverImageUrl', url)}
        disabled={disabled}
      />

      <Field label="Title">
        <TextInput
          value={value.title}
          onChangeText={(t) => set('title', t)}
          placeholder="Sunday Gathering"
          placeholderTextColor={theme.dark.textMuted}
          style={styles.input}
          editable={!disabled}
          maxLength={140}
        />
      </Field>

      <Field label="Short summary" hint="One line, shown on the event card.">
        <TextInput
          value={value.summary}
          onChangeText={(t) => set('summary', t)}
          placeholder="Weekly worship and teaching"
          placeholderTextColor={theme.dark.textMuted}
          style={styles.input}
          editable={!disabled}
          maxLength={280}
        />
      </Field>

      <Field label="Description">
        <TextInput
          value={value.description}
          onChangeText={(t) => set('description', t)}
          placeholder="What should people expect?"
          placeholderTextColor={theme.dark.textMuted}
          style={[styles.input, styles.multiline]}
          editable={!disabled}
          multiline
          maxLength={10000}
        />
      </Field>

      <Field label="Category">
        <View style={styles.chips}>
          {CATEGORIES.map((c) => {
            const on = value.category === c;
            return (
              <Pressable
                key={c}
                disabled={disabled}
                onPress={() => set('category', c)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.replace('_', ' ')}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <DateField
        label="Date"
        value={value.date}
        onChange={(d) => set('date', d)}
        disabled={disabled}
      />

      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <View style={{ flex: 1 }}>
          <TimeField
            label="Starts"
            value={value.startTime}
            onChange={(t) => set('startTime', t)}
            disabled={disabled}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField
            label="Ends"
            value={value.endTime}
            onChange={(t) => set('endTime', t)}
            disabled={disabled}
          />
        </View>
      </View>

      {mode === 'create' && <RepeatField value={value} set={set} disabled={disabled} />}

      <View>
        <Text style={styles.label}>How can people attend?</Text>
        <View style={styles.segmented}>
          {LOCATION_MODES.map((m) => {
            const on = value.locationMode === m.value;
            return (
              <Pressable
                key={m.value}
                disabled={disabled}
                onPress={() => set('locationMode', m.value)}
                style={[styles.segment, on && styles.segmentOn]}
              >
                <Ionicons
                  name={m.icon}
                  size={16}
                  color={on ? palette.coral[200] : theme.dark.textSecondary}
                />
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{LOCATION_MODES.find((m) => m.value === value.locationMode)?.hint}</Text>
      </View>

      {value.locationMode !== 'in_person' && (
        <Field label="Stream link" hint="Where people watch — YouTube, Zoom, whatever you use.">
          <TextInput
            value={value.onlineUrl}
            onChangeText={(t) => set('onlineUrl', t)}
            placeholder="https://…"
            placeholderTextColor={theme.dark.textMuted}
            style={styles.input}
            editable={!disabled}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>
      )}

      {value.locationMode !== 'online' && (
        <View style={styles.venueBox}>
          <Field label="Venue name">
            <TextInput
              value={value.venueName}
              onChangeText={(t) => set('venueName', t)}
              placeholder="Main Hall"
              placeholderTextColor={theme.dark.textMuted}
              style={styles.input}
              editable={!disabled}
            />
          </Field>
          <Field label="Address">
            <TextInput
              value={value.addressLine1}
              onChangeText={(t) => set('addressLine1', t)}
              placeholder="2 Chapel Road"
              placeholderTextColor={theme.dark.textMuted}
              style={styles.input}
              editable={!disabled}
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Field label="Town or city">
                <TextInput
                  value={value.city}
                  onChangeText={(t) => set('city', t)}
                  placeholder="Leeds"
                  placeholderTextColor={theme.dark.textMuted}
                  style={styles.input}
                  editable={!disabled}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Postcode">
                <TextInput
                  value={value.postalCode}
                  onChangeText={(t) => set('postalCode', t)}
                  placeholder="LS1 4AB"
                  placeholderTextColor={theme.dark.textMuted}
                  style={styles.input}
                  editable={!disabled}
                  autoCapitalize="characters"
                />
              </Field>
            </View>
          </View>
        </View>
      )}

      <Field label="Capacity" hint="Leave blank for no limit.">
        <TextInput
          value={value.capacity}
          onChangeText={(t) => set('capacity', t)}
          placeholder="No limit"
          placeholderTextColor={theme.dark.textMuted}
          style={styles.input}
          editable={!disabled}
          keyboardType="number-pad"
        />
      </Field>
    </View>
  );
}

/**
 * Does not repeat / Weekly / Monthly, with a count and the dates it will make.
 * Mirrors the web's RepeatFields: the same rule goes to the same endpoint.
 */
function RepeatField({
  value,
  set,
  disabled,
}: {
  value: EventFormValues;
  set: <K extends keyof EventFormValues>(key: K, v: EventFormValues[K]) => void;
  disabled?: boolean;
}) {
  const count = Number(value.repeatCount.trim());
  const start = toInstant(value.date, value.startTime);
  const end = toInstant(value.date, value.endTime);
  const dates =
    value.repeat !== 'none' && start && end && end > start && Number.isInteger(count) && count >= REPEAT_MIN_COUNT && count <= REPEAT_MAX_COUNT
      ? seriesOccurrences(start, end, { every: value.repeat, count }, deviceTimezone())
      : null;
  const bump = (by: number) =>
    set('repeatCount', String(Math.min(REPEAT_MAX_COUNT, Math.max(REPEAT_MIN_COUNT, (Number.isInteger(count) ? count : 6) + by))));
  return (
    <View style={styles.repeatBox}>
      <Text style={styles.label}>Repeats</Text>
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel="Repeats">
        {REPEAT_OPTIONS.map((o) => {
          const on = value.repeat === o.value;
          return (
            <Pressable
              key={o.value}
              disabled={disabled}
              onPress={() => set('repeat', o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              style={[styles.segment, on && styles.segmentOn]}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{REPEAT_OPTIONS.find((o) => o.value === value.repeat)?.hint}</Text>

      {value.repeat !== 'none' && (
        <>
          <View style={styles.stepperRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>How many dates</Text>
              <Text style={styles.hint}>Each date is its own event with its own bookings.</Text>
            </View>
            <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel="How many dates" accessibilityValue={{ text: value.repeatCount }}>
              <Pressable
                onPress={() => bump(-1)}
                disabled={disabled || count <= REPEAT_MIN_COUNT}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Fewer dates"
                style={styles.stepBtn}
              >
                <Ionicons name="remove" size={18} color={theme.dark.textPrimary} />
              </Pressable>
              <TextInput
                value={value.repeatCount}
                onChangeText={(t) => set('repeatCount', t.replace(/[^0-9]/g, ''))}
                style={styles.stepInput}
                editable={!disabled}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Number of dates"
              />
              <Pressable
                onPress={() => bump(1)}
                disabled={disabled || count >= REPEAT_MAX_COUNT}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More dates"
                style={styles.stepBtn}
              >
                <Ionicons name="add" size={18} color={theme.dark.textPrimary} />
              </Pressable>
            </View>
          </View>
          {dates ? (
            <View style={styles.chips} accessibilityLabel="Dates in this series">
              {dates.slice(0, 6).map((o, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {o.startsAt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))}
              {dates.length > 6 && <Text style={[styles.hint, { alignSelf: 'center' }]}>and {dates.length - 6} more</Text>}
            </View>
          ) : (
            <Text style={styles.hint}>Set the date and times above to see the dates.</Text>
          )}
        </>
      )}
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSize.sm, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  hint: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  input: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: theme.dark.textPrimary,
    backgroundColor: theme.dark.surface,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  chipOn: { backgroundColor: 'rgba(249,142,128,0.14)', borderColor: 'rgba(249,142,128,0.55)' },
  chipText: { fontSize: fontSize.xs, color: theme.dark.textSecondary, textTransform: 'capitalize' },
  chipTextOn: { color: palette.coral[200] },
  segmented: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingVertical: spacing[3],
  },
  segmentOn: { backgroundColor: 'rgba(249,142,128,0.14)', borderColor: 'rgba(249,142,128,0.55)' },
  segmentText: { fontSize: fontSize.sm, color: theme.dark.textSecondary },
  segmentTextOn: { color: palette.coral[200] },
  venueBox: {
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: theme.dark.surface,
  },
  repeatBox: {
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
  },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    backgroundColor: theme.dark.surface,
  },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepInput: {
    width: 44,
    textAlign: 'center',
    fontSize: fontSize.base,
    color: theme.dark.textPrimary,
    paddingVertical: spacing[2],
  },
});

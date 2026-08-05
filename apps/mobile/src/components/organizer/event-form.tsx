import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';

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
  isOnline: boolean;
  onlineUrl: string;
  venueName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  capacity: string;
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
    isOnline: false,
    onlineUrl: '',
    venueName: '',
    addressLine1: '',
    city: '',
    postalCode: '',
    capacity: '',
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
  if (!start) return 'Enter the date as YYYY-MM-DD and the start time as HH:MM.';
  const end = toInstant(v.date, v.endTime);
  if (!end) return 'Enter the end time as HH:MM.';
  if (end <= start) return 'The end time must be after the start time.';
  if (v.isOnline) {
    if (!/^https?:\/\//i.test(v.onlineUrl.trim())) return 'Enter the stream link, starting with https://';
  } else {
    if (!v.venueName.trim()) return 'Enter the venue name.';
    if (!v.addressLine1.trim()) return 'Enter the venue address.';
    if (!v.city.trim()) return 'Enter the town or city.';
  }
  if (v.capacity.trim() && !/^\d+$/.test(v.capacity.trim())) return 'Capacity must be a whole number.';
  return null;
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
    isOnline: v.isOnline,
    onlineUrl: v.isOnline ? v.onlineUrl.trim() : absent,
    capacity,
    venue: v.isOnline ? absent : venue,
  };
}

export function EventForm({
  value,
  onChange,
  disabled,
}: {
  value: EventFormValues;
  onChange: (next: EventFormValues) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof EventFormValues>(key: K, v: EventFormValues[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <View style={{ gap: spacing[4] }}>
      <Field label="Title">
        <TextInput
          value={value.title}
          onChangeText={(t) => set('title', t)}
          placeholder="Sunday Gathering"
          placeholderTextColor={color.ink[300]}
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
          placeholderTextColor={color.ink[300]}
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
          placeholderTextColor={color.ink[300]}
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

      <Field label="Date" hint="YYYY-MM-DD">
        <TextInput
          value={value.date}
          onChangeText={(t) => set('date', t)}
          placeholder="2026-08-02"
          placeholderTextColor={color.ink[300]}
          style={styles.input}
          editable={!disabled}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </Field>

      <View style={{ flexDirection: 'row', gap: spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Field label="Starts" hint="HH:MM">
            <TextInput
              value={value.startTime}
              onChangeText={(t) => set('startTime', t)}
              placeholder="10:30"
              placeholderTextColor={color.ink[300]}
              style={styles.input}
              editable={!disabled}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Ends" hint="HH:MM">
            <TextInput
              value={value.endTime}
              onChangeText={(t) => set('endTime', t)}
              placeholder="12:00"
              placeholderTextColor={color.ink[300]}
              style={styles.input}
              editable={!disabled}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </Field>
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Online event</Text>
          <Text style={styles.hint}>Streamed instead of in person.</Text>
        </View>
        <Switch
          value={value.isOnline}
          onValueChange={(b) => set('isOnline', b)}
          disabled={disabled}
          trackColor={{ false: color.ink[200], true: color.ink[900] }}
          thumbColor={color.ink[0]}
        />
      </View>

      {value.isOnline ? (
        <Field label="Stream link">
          <TextInput
            value={value.onlineUrl}
            onChangeText={(t) => set('onlineUrl', t)}
            placeholder="https://…"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
            editable={!disabled}
            autoCapitalize="none"
            keyboardType="url"
          />
        </Field>
      ) : (
        <View style={styles.venueBox}>
          <Field label="Venue name">
            <TextInput
              value={value.venueName}
              onChangeText={(t) => set('venueName', t)}
              placeholder="Main Hall"
              placeholderTextColor={color.ink[300]}
              style={styles.input}
              editable={!disabled}
            />
          </Field>
          <Field label="Address">
            <TextInput
              value={value.addressLine1}
              onChangeText={(t) => set('addressLine1', t)}
              placeholder="2 Chapel Road"
              placeholderTextColor={color.ink[300]}
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
                  placeholderTextColor={color.ink[300]}
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
                  placeholderTextColor={color.ink[300]}
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
          placeholderTextColor={color.ink[300]}
          style={styles.input}
          editable={!disabled}
          keyboardType="number-pad"
        />
      </Field>
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
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink[900] },
  hint: { fontSize: fontSize.xs, color: color.ink[500], marginTop: 2 },
  input: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
    backgroundColor: color.ink[0],
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  chip: {
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  chipOn: { backgroundColor: color.ink[900], borderColor: color.ink[900] },
  chipText: { fontSize: fontSize.xs, color: color.ink[700], textTransform: 'capitalize' },
  chipTextOn: { color: color.ink[0] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  venueBox: {
    gap: spacing[4],
    padding: spacing[4],
    borderRadius: radius.lg,
    backgroundColor: color.ink[50],
  },
});

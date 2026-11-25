'use client';

import { Field } from '@/components/controls';
import { Cover } from '@/components/cover';
import { ImageUpload } from '@/components/image-upload';
import { LocationModePicker, modeOf, type LocationMode } from '@/components/location-mode-picker';
import { CATEGORIES, categoryOf, type CategoryValue } from '@/lib/categories';
import { fmtDay, fmtTime } from '@/lib/format';
import { zonedInstant } from '@/lib/zoned-time';
import type { ReactNode } from 'react';
import { PressedChips } from './steps';

/** The editable shape of an event, in the units the form works in. */
export interface EventDraft {
  title: string;
  summary: string;
  description: string;
  category: CategoryValue;
  date: string; // YYYY-MM-DD, local
  start: string; // HH:mm
  end: string; // HH:mm — before `start` means it runs past midnight
  mode: LocationMode;
  onlineUrl: string;
  venueName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
  capacity: string;
  coverImageUrl: string | null;
}

export const emptyDraft = (country = 'GB'): EventDraft => ({
  title: '',
  summary: '',
  description: '',
  category: 'service',
  date: '',
  start: '10:30',
  end: '12:00',
  mode: 'in_person',
  onlineUrl: '',
  venueName: '',
  addressLine1: '',
  city: '',
  postalCode: '',
  country,
  capacity: '',
  coverImageUrl: null,
});

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function draftFromEvent(e: {
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number | null;
  coverImageUrl: string | null;
  venue: { name: string; addressLine1: string; city: string; postalCode: string; country: string } | null;
}): EventDraft {
  const s = new Date(e.startsAt);
  const en = new Date(e.endsAt);
  return {
    title: e.title,
    summary: e.summary ?? '',
    description: e.description ?? '',
    category: categoryOf(e.category).value,
    date: localDate(s),
    start: localTime(s),
    end: localTime(en),
    mode: modeOf(e),
    onlineUrl: e.onlineUrl ?? '',
    venueName: e.venue?.name ?? '',
    addressLine1: e.venue?.addressLine1 ?? '',
    city: e.venue?.city ?? '',
    postalCode: e.venue?.postalCode ?? '',
    country: e.venue?.country ?? 'GB',
    capacity: e.capacity === null ? '' : String(e.capacity),
    coverImageUrl: e.coverImageUrl,
  };
}

export { zonedInstant };

const nextDay = (date: string) => {
  const [y, m, day] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, day! + 1)).toISOString().slice(0, 10);
};

/**
 * Start and end as Dates; an end time at or before the start rolls to the next day.
 * Times are read in the browser's timezone, or in `timeZone` when given (staff
 * entering a church's event in the church's own time).
 */
export function draftTimes(d: EventDraft, timeZone?: string) {
  if (!d.date || !d.start || !d.end) return null;
  if (timeZone) {
    const startsAt = zonedInstant(d.date, d.start, timeZone);
    const endsAt = zonedInstant(d.end <= d.start ? nextDay(d.date) : d.date, d.end, timeZone);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
    return { startsAt, endsAt };
  }
  const startsAt = new Date(`${d.date}T${d.start}`);
  const endsAt = new Date(`${d.date}T${d.end}`);
  if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
  if (Number.isNaN(startsAt.getTime())) return null;
  return { startsAt, endsAt };
}

/** Problems to fix before saving, keyed by field. */
export function validateDraft(d: EventDraft): Partial<Record<keyof EventDraft, string>> {
  const errs: Partial<Record<keyof EventDraft, string>> = {};
  if (d.title.trim().length < 3) errs.title = 'Give it a title of at least 3 characters.';
  if (!draftTimes(d)) errs.date = 'Choose a date and times.';
  if (d.mode !== 'in_person' && !/^https?:\/\//.test(d.onlineUrl.trim()))
    errs.onlineUrl = 'Add the full link, starting https://';
  if (d.mode !== 'online') {
    if (!d.venueName.trim()) errs.venueName = 'Add the venue’s name.';
    if (!d.city.trim()) errs.city = 'Add the town or city.';
  }
  if (d.capacity && !(Number(d.capacity) >= 1)) errs.capacity = 'Use a number, or leave blank for no limit.';
  return errs;
}

/**
 * The fields the API's create and update schemas share. `timeZone` (optional)
 * reads the times in that zone and sends it as the event's timezone; without
 * it, the browser's.
 */
export function draftToPayload(d: EventDraft, forUpdate: boolean, timeZone?: string) {
  const t = draftTimes(d, timeZone)!;
  const blank = forUpdate ? null : undefined;
  const opt = (v: string) => (v.trim() ? v.trim() : forUpdate ? '' : undefined);
  return {
    title: d.title.trim(),
    summary: opt(d.summary),
    description: opt(d.description),
    category: d.category,
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt.toISOString(),
    timezone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    isOnline: d.mode !== 'in_person',
    onlineUrl: d.mode === 'in_person' ? blank : d.onlineUrl.trim(),
    capacity: d.capacity ? Number(d.capacity) : blank,
    coverImageUrl: d.coverImageUrl ?? blank,
    venue:
      d.mode === 'online'
        ? blank
        : {
            name: d.venueName.trim(),
            addressLine1: d.addressLine1.trim(),
            city: d.city.trim(),
            postalCode: d.postalCode.trim(),
            country: d.country,
          },
  };
}

type Setter = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
type Errors = Partial<Record<keyof EventDraft, string>>;

export function BasicsFields({ d, set, errors = {} }: { d: EventDraft; set: Setter; errors?: Errors }) {
  return (
    <div className="flex flex-col gap-6">
      <ImageUpload
        purpose="event_cover"
        value={d.coverImageUrl}
        onChange={(v) => set('coverImageUrl', v)}
        label="Cover image"
        hint="Without one we make a cover for you."
        variant="cover"
      />
      <Field label="Event name" error={errors.title}>
        {(p) => (
          <input
            {...p}
            className="input"
            required
            minLength={3}
            maxLength={140}
            placeholder="Sunday Gathering"
            value={d.title}
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Field>
      <PressedChips
        legend="Category"
        value={d.category}
        onChange={(v) => set('category', v)}
        options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
      />
      <Field
        label="Short summary"
        hint="One line, shown on event cards."
        aside={<span className="text-[12px] text-faint">{d.summary.length}/280</span>}
      >
        {(p) => (
          <input {...p} className="input" maxLength={280} value={d.summary} onChange={(e) => set('summary', e.target.value)} />
        )}
      </Field>
      <Field label="Description">
        {(p) => (
          <textarea
            {...p}
            className="input min-h-[120px]"
            rows={4}
            maxLength={10_000}
            placeholder="What to expect, who it’s for, anything people should bring."
            value={d.description}
            onChange={(e) => set('description', e.target.value)}
          />
        )}
      </Field>
    </div>
  );
}

export function WhenWhereFields({
  d,
  set,
  errors = {},
  disabled,
  timeNote,
}: {
  d: EventDraft;
  set: Setter;
  errors?: Errors;
  disabled?: boolean;
  /** A line under the date and times, e.g. which timezone they're in. */
  timeNote?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* TODO(confirm): the design has a "Repeats weekly" switch; the API has
          no recurring events. */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Field label="Date" error={errors.date}>
          {(p) => <input {...p} type="date" required className="input" value={d.date} onChange={(e) => set('date', e.target.value)} />}
        </Field>
        <Field label="Starts">
          {(p) => <input {...p} type="time" required className="input" value={d.start} onChange={(e) => set('start', e.target.value)} />}
        </Field>
        <Field label="Ends" hint={d.end && d.start && d.end <= d.start ? 'Finishes the next day.' : undefined}>
          {(p) => <input {...p} type="time" required className="input" value={d.end} onChange={(e) => set('end', e.target.value)} />}
        </Field>
      </div>
      {timeNote ? <p className="hint -mt-3">{timeNote}</p> : null}

      <LocationModePicker value={d.mode} onChange={(m) => set('mode', m)} disabled={disabled} />

      {d.mode !== 'in_person' && (
        <Field label="Stream link" hint="Where people watch — YouTube, Zoom, whatever you use." error={errors.onlineUrl}>
          {(p) => (
            <input
              {...p}
              type="url"
              className="input"
              placeholder="https://"
              value={d.onlineUrl}
              onChange={(e) => set('onlineUrl', e.target.value)}
            />
          )}
        </Field>
      )}

      {d.mode !== 'online' && (
        <fieldset className="flex flex-col gap-5 rounded-panel border border-line p-5">
          <legend className="eyebrow px-2 text-[10px] text-faint">Venue</legend>
          <Field label="Venue name" error={errors.venueName}>
            {(p) => (
              <input {...p} className="input" placeholder="St Mary’s Church Hall" value={d.venueName} onChange={(e) => set('venueName', e.target.value)} />
            )}
          </Field>
          <Field label="Address">
            {(p) => (
              <input
                {...p}
                className="input"
                autoComplete="address-line1"
                value={d.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr]">
            <Field label="Town or city" error={errors.city}>
              {(p) => <input {...p} className="input" value={d.city} onChange={(e) => set('city', e.target.value)} />}
            </Field>
            <Field label="Postcode">
              {(p) => <input {...p} className="input" value={d.postalCode} onChange={(e) => set('postalCode', e.target.value)} />}
            </Field>
            <Field label="Country">
              {(p) => (
                <select {...p} className="input" value={d.country} onChange={(e) => set('country', e.target.value)}>
                  <option value="GB">United Kingdom</option>
                  <option value="IE">Ireland</option>
                  <option value="US">United States</option>
                </select>
              )}
            </Field>
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function CapacityField({ d, set, errors = {} }: { d: EventDraft; set: Setter; errors?: Errors }) {
  return (
    <Field label="Places available" hint="Leave blank for no limit. Bookings close when it’s full." error={errors.capacity}>
      {(p) => (
        <input
          {...p}
          type="number"
          min={1}
          inputMode="numeric"
          className="input max-w-[220px]"
          placeholder="No limit"
          value={d.capacity}
          onChange={(e) => set('capacity', e.target.value)}
        />
      )}
    </Field>
  );
}

/** Live preview: what the event card will look like on Discover. */
export function EventPreview({ d, host, timeZone }: { d: EventDraft; host: string; timeZone?: string }) {
  const t = draftTimes(d, timeZone);
  const cat = categoryOf(d.category);
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-[10px] text-faint">How it looks on Discover</span>
      <article className="card overflow-hidden" aria-label="Event card preview">
        <div className="relative aspect-[16/10] bg-surface-2">
          <Cover image={d.coverImageUrl} category={d.category} title={d.title || 'Your event'} />
          <span className="tag-solid absolute left-3.5 top-3.5">{cat.label}</span>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <span className="eyebrow text-ink-2">
            {t
              ? `${fmtDay(t.startsAt.toISOString(), timeZone)} at ${fmtTime(t.startsAt.toISOString(), timeZone)}`
              : 'Date to be set'}
          </span>
          <span className="text-[20px] leading-tight text-strong">{d.title || 'Your event title'}</span>
          <span className="text-[14px] text-muted">{host}</span>
          <span className="pt-2 text-[14px] text-accent">Free</span>
        </div>
      </article>
    </div>
  );
}

/**
 * The tickets step's type switch. Only Free is bookable today.
 * TODO(confirm #2, #3): paid tiers and donation tickets. RSVP refuses any
 * event with a priced ticket type and there's no checkout or donations API,
 * so Paid and Donation are shown but can't be chosen. `freeOnly` (staff
 * adding events for an unclaimed church) drops the switch altogether. The
 * payload has no ticket types either way, so the event is always free.
 */
export function TicketKind({ freeOnly = false }: { freeOnly?: boolean } = {}) {
  if (freeOnly) {
    // Staff-added (unclaimed) churches: free only, enforced on the API too.
    // Nothing to choose, so state it rather than show a one-option switch.
    return (
      <div className="flex flex-col gap-2">
        <span className="label">Tickets</span>
        <p className="text-[15px] text-strong">Free</p>
        <p className="text-[14px] leading-relaxed text-muted">
          Churches added by Ekklesia can only have free events until they claim their page. Attendees get a QR ticket
          just the same.
        </p>
      </div>
    );
  }
  const kinds = [
    { label: 'Paid', on: false, disabled: true },
    { label: 'Free', on: true, disabled: false },
    { label: 'Donation', on: false, disabled: true },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Ticket type" className="inline-flex gap-1 self-start rounded-full border border-line p-1">
        {kinds.map((k) => (
          <button
            key={k.label}
            type="button"
            aria-pressed={k.on}
            disabled={k.disabled}
            title={k.disabled ? 'Not available yet' : undefined}
            className={`rounded-full px-[18px] py-2 text-[14px] transition-colors disabled:cursor-not-allowed disabled:text-faint ${
              k.on ? 'bg-soft text-accent-ink' : 'text-ink-2'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-[14px] leading-relaxed text-muted">
        Free events have no fees. Attendees get a QR ticket just the same. Paid and donation tickets aren&rsquo;t
        available yet.
      </p>
    </div>
  );
}

/** "Where" for the review list. */
export function draftWhere(d: EventDraft) {
  if (d.mode === 'online') return 'Online';
  return `${d.venueName || '—'}${d.city ? `, ${d.city}` : ''}${d.mode === 'hybrid' ? ' + online' : ''}`;
}

/** The review step's summary rows. */
export function ReviewList({ d }: { d: EventDraft }) {
  const t = draftTimes(d);
  const rows: [string, string][] = [
    ['Event', d.title || '—'],
    ['Category', categoryOf(d.category).label],
    [
      'When',
      t ? `${fmtDay(t.startsAt.toISOString())} · ${fmtTime(t.startsAt.toISOString())}–${fmtTime(t.endsAt.toISOString())}` : '—',
    ],
    ['Where', draftWhere(d)],
    ['Tickets', d.capacity ? `Free · ${d.capacity} places` : 'Free · no limit'],
  ];
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6 border-b border-line py-3.5 text-[15px]">
          <dt className="flex-none text-ink-2">{k}</dt>
          <dd className="min-w-0 text-right text-ink [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VisibilityChips({
  value,
  onChange,
}: {
  value: 'public' | 'unlisted';
  onChange: (v: 'public' | 'unlisted') => void;
}) {
  return (
    <PressedChips
      legend="Visibility"
      value={value}
      onChange={onChange}
      options={[
        { value: 'public', label: 'Public' },
        { value: 'unlisted', label: 'Unlisted' },
      ]}
      hint={value === 'public' ? 'Shown on Discover and your host page.' : 'Only people with the link can find it.'}
    />
  );
}

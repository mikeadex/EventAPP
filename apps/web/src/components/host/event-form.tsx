'use client';

import { Field } from '@/components/controls';
import { Cover } from '@/components/cover';
import { Icon } from '@/components/icons';
import { ImageUpload } from '@/components/image-upload';
import { LocationModePicker, modeOf, type LocationMode } from '@/components/location-mode-picker';
import { CATEGORIES, categoryOf, type CategoryValue } from '@/lib/categories';
import { fmtDay, fmtTime } from '@/lib/format';

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

/** Start and end as Dates; an end time at or before the start rolls to the next day. */
export function draftTimes(d: EventDraft) {
  if (!d.date || !d.start || !d.end) return null;
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

/** The fields the API's create and update schemas share. */
export function draftToPayload(d: EventDraft, forUpdate: boolean) {
  const t = draftTimes(d)!;
  const blank = forUpdate ? null : undefined;
  const opt = (v: string) => (v.trim() ? v.trim() : forUpdate ? '' : undefined);
  return {
    title: d.title.trim(),
    summary: opt(d.summary),
    description: opt(d.description),
    category: d.category,
    startsAt: t.startsAt.toISOString(),
    endsAt: t.endsAt.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        hint="Landscape works best (1600×900). Without one we make a cover for you."
      />
      <Field label="Event title" error={errors.title}>
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
      <div className="flex flex-col gap-2">
        <span className="label" id="cat-label">
          Category
        </span>
        <div role="radiogroup" aria-labelledby="cat-label" className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={d.category === c.value}
              className={`chip ${d.category === c.value ? 'on' : ''}`}
              onClick={() => set('category', c.value)}
            >
              <Icon name={c.icon} size={15} /> {c.label}
            </button>
          ))}
        </div>
      </div>
      <Field
        label="Short summary"
        hint="One line, shown on event cards."
        aside={<span className="text-[12px] text-faint">{d.summary.length}/280</span>}
      >
        {(p) => (
          <input {...p} className="input" maxLength={280} value={d.summary} onChange={(e) => set('summary', e.target.value)} />
        )}
      </Field>
      <Field label="About this event">
        {(p) => (
          <textarea
            {...p}
            className="input min-h-[160px]"
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
}: {
  d: EventDraft;
  set: Setter;
  errors?: Errors;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr]">
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
    <Field label="How many places?" hint="Leave blank for no limit. Bookings close when it’s full." error={errors.capacity}>
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
export function EventPreview({ d, host }: { d: EventDraft; host: string }) {
  const t = draftTimes(d);
  const cat = categoryOf(d.category);
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-[10px] text-faint">Preview</span>
      <article className="card overflow-hidden" aria-label="Event card preview">
        <div className="relative aspect-[16/10] bg-surface-2">
          <Cover image={d.coverImageUrl} category={d.category} title={d.title || 'Your event'} />
          <span className="tag-solid absolute left-3.5 top-3.5">{cat.label}</span>
        </div>
        <div className="flex flex-col gap-2 p-5">
          <span className="eyebrow text-ink-2">
            {t ? `${fmtDay(t.startsAt.toISOString())} at ${fmtTime(t.startsAt.toISOString())}` : 'Date to be set'}
          </span>
          <span className="text-[20px] leading-tight text-strong">{d.title || 'Your event title'}</span>
          <span className="text-[14px] text-muted">{host}</span>
          <span className="pt-2 text-[14px] text-accent">Free</span>
        </div>
      </article>
    </div>
  );
}

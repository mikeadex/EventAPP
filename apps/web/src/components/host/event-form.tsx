'use client';

import { Field } from '@/components/controls';
import { Cover } from '@/components/cover';
import { ImageUpload } from '@/components/image-upload';
import { LocationModePicker, modeOf, type LocationMode } from '@/components/location-mode-picker';
import { CATEGORIES, categoryOf, type CategoryValue } from '@/lib/categories';
import { Icon } from '@/components/icons';
import { fmtDay, fmtTime, money } from '@/lib/format';
import { PLATFORM_FEE_BPS } from '@/lib/payments';
import type { PaidTicketsGate } from '@/lib/use-payouts';
import { zonedInstant } from '@/lib/zoned-time';
import Link from 'next/link';
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
export function EventPreview({
  d,
  host,
  timeZone,
  price = 'Free',
}: {
  d: EventDraft;
  host: string;
  timeZone?: string;
  /** The card's price label, e.g. "From £10". */
  price?: string;
}) {
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
          <span className="pt-2 text-[14px] text-accent">{price}</span>
        </div>
      </article>
    </div>
  );
}

export type TicketKindValue = 'free' | 'paid';

/**
 * The tickets step's type switch: Paid / Free / Donation.
 *
 * Paid opens once the host passes both gates in `usePaidTicketsGate` (the
 * `paid_tickets` flag and Stripe payouts ENABLED); until then it stays
 * disabled with the way forward underneath. `freeOnly` (staff adding events
 * for an unclaimed church) drops the switch altogether.
 *
 * TODO(confirm #3): donation tickets. There is no donations API, so Donation
 * is shown but can't be chosen.
 */
export function TicketKind({
  value = 'free',
  onChange,
  gate,
  payoutsHref,
  freeOnly = false,
  disabled = false,
}: {
  value?: TicketKindValue;
  onChange?: (v: TicketKindValue) => void;
  gate?: PaidTicketsGate;
  /** The payouts page, offered when Stripe isn't set up yet. */
  payoutsHref?: string;
  freeOnly?: boolean;
  disabled?: boolean;
} = {}) {
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
  const paidReady = gate?.status === 'ready';
  const canPaid = paidReady && gate.canSell;
  const kinds: { label: string; value: TicketKindValue | 'donation'; disabled: boolean; title?: string }[] = [
    {
      label: 'Paid',
      value: 'paid',
      disabled: !canPaid && value !== 'paid',
      title: !paidReady ? 'Checking your payout setup…' : canPaid ? undefined : 'Set up payouts first',
    },
    { label: 'Free', value: 'free', disabled: false },
    { label: 'Donation', value: 'donation', disabled: true, title: 'Not available yet' },
  ];

  let note: ReactNode;
  if (value === 'paid') {
    note = (
      <>
        Attendees pay the ticket price plus one booking fee of {PLATFORM_FEE_BPS / 100}% on top. You receive the full
        ticket price, paid out by Stripe.
      </>
    );
  } else if (!gate || gate.status === 'loading') {
    // TODO(confirm): docs/04 #7 — that free events carry no fee.
    note = 'Free events have no fees. Attendees get a QR ticket just the same.';
  } else if (!gate.flag) {
    note = 'Free events have no fees. Paid tickets aren’t switched on for your organisation yet.';
  } else if (gate.payout === 'ENABLED') {
    note = 'Free events have no fees. Choose Paid to sell tickets.';
  } else if (gate.payout === 'UNKNOWN' || !gate.canManagePayouts) {
    note = 'Free events have no fees. To sell tickets, an owner or admin needs to set up payouts first.';
  } else {
    note = (
      <>
        Free events have no fees. To sell tickets, set up payouts first —{' '}
        {payoutsHref ? (
          <Link href={payoutsHref as never} className="text-accent underline-offset-2 hover:underline">
            {gate.payout === 'NOT_STARTED' ? 'set up payouts' : 'finish setting up payouts'}
          </Link>
        ) : (
          'from Payouts in your dashboard'
        )}
        .
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Ticket type" className="inline-flex gap-1 self-start rounded-full border border-line p-1">
        {kinds.map((k) => (
          <button
            key={k.label}
            type="button"
            aria-pressed={k.value === value}
            disabled={disabled || k.disabled}
            title={k.title}
            onClick={() => k.value !== 'donation' && onChange?.(k.value)}
            className={`rounded-full px-[18px] py-2 text-[14px] transition-colors disabled:cursor-not-allowed ${
              k.value === value ? 'bg-soft text-accent-ink' : 'text-ink-2 disabled:text-faint'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-[14px] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

/** A priced ticket type as the create form holds it, before the event exists. */
export interface TierDraft {
  key: string;
  name: string;
  /** Pounds, as typed: "10" or "12.50". Stored as `priceMinor`. */
  price: string;
  /** How many, as typed; blank means no limit. */
  quantity: string;
}

let tierSeq = 0;
export const newTier = (): TierDraft => ({ key: `t${++tierSeq}`, name: '', price: '', quantity: '' });

/** "12.50" → 1250, or null if it isn't a sum of money. */
export function priceToMinor(price: string): number | null {
  const t = price.trim().replace(/^£/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Problems with the paid tiers, by row index. */
export function validateTiers(tiers: TierDraft[]): Record<number, string> {
  const errs: Record<number, string> = {};
  tiers.forEach((t, i) => {
    const minor = priceToMinor(t.price);
    if (!t.name.trim()) errs[i] = 'Give this ticket a name.';
    else if (minor === null) errs[i] = 'Use a price like 10 or 12.50.';
    else if (minor < 100) errs[i] = 'Paid tickets start at £1.';
    else if (t.quantity && !(Number(t.quantity) >= 1)) errs[i] = 'Use a number, or leave blank for no limit.';
  });
  return errs;
}

export function tierToPayload(t: TierDraft, currency = 'GBP') {
  return {
    name: t.name.trim(),
    priceMinor: priceToMinor(t.price) ?? 0,
    currency,
    quantity: t.quantity ? Number(t.quantity) : NO_LIMIT,
  };
}

/** The API's quantity cap, used as "no limit". */
export const NO_LIMIT = 1_000_000;

/**
 * Paid tier rows for the create form: name, price and quantity each, plus
 * "+ Add another ticket". The design's "Attendee pays / You receive" preview
 * reduces to one line here because there is one fee and the host keeps the
 * ticket price.
 */
export function TierRows({
  tiers,
  onChange,
  errors = {},
}: {
  tiers: TierDraft[];
  onChange: (next: TierDraft[]) => void;
  errors?: Record<number, string>;
}) {
  const update = (i: number, patch: Partial<TierDraft>) =>
    onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="label mb-3">Ticket types</legend>
      <ul className="flex flex-col gap-3">
        {tiers.map((t, i) => {
          const minor = priceToMinor(t.price);
          return (
            <li key={t.key} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Name">
                  {(p) => (
                    <input
                      {...p}
                      className="input"
                      maxLength={80}
                      placeholder="General admission"
                      value={t.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      aria-invalid={errors[i] ? true : undefined}
                    />
                  )}
                </Field>
                <Field label="Price (£)">
                  {(p) => (
                    <input
                      {...p}
                      className="input font-mono"
                      inputMode="decimal"
                      placeholder="10.00"
                      value={t.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="How many">
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="input"
                      placeholder="No limit"
                      value={t.quantity}
                      onChange={(e) => update(i, { quantity: e.target.value })}
                    />
                  )}
                </Field>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm self-end"
                  disabled={tiers.length === 1}
                  onClick={() => onChange(tiers.filter((_, j) => j !== i))}
                  aria-label={`Remove ${t.name || `ticket ${i + 1}`}`}
                  title={tiers.length === 1 ? 'A paid event needs at least one ticket type' : undefined}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              {errors[i] ? (
                <span className="error-text">{errors[i]}</span>
              ) : minor !== null && minor > 0 ? (
                <span className="hint">
                  Attendees pay {money(minor + Math.round((minor * PLATFORM_FEE_BPS) / 10_000))} · you receive{' '}
                  {money(minor)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-outline self-start" onClick={() => onChange([...tiers, newTier()])}>
        <Icon name="plus" size={16} /> Add another ticket
      </button>
    </fieldset>
  );
}

/** "£10" or "From £10" for a set of tiers; "Free" for none. */
export function tiersLabel(tiers: TierDraft[]) {
  const prices = tiers.map((t) => priceToMinor(t.price)).filter((m): m is number => m !== null && m > 0);
  if (prices.length === 0) return 'Free';
  const min = Math.min(...prices);
  return prices.length > 1 && Math.max(...prices) !== min ? `From ${money(min)}` : money(min);
}

/** "Where" for the review list. */
export function draftWhere(d: EventDraft) {
  if (d.mode === 'online') return 'Online';
  return `${d.venueName || '—'}${d.city ? `, ${d.city}` : ''}${d.mode === 'hybrid' ? ' + online' : ''}`;
}

/** The review step's summary rows. */
export function ReviewList({ d, tiers }: { d: EventDraft; tiers?: TierDraft[] }) {
  const t = draftTimes(d);
  const price = tiers?.length ? tiersLabel(tiers) : 'Free';
  const rows: [string, string][] = [
    ['Event', d.title || '—'],
    ['Category', categoryOf(d.category).label],
    [
      'When',
      t ? `${fmtDay(t.startsAt.toISOString())} · ${fmtTime(t.startsAt.toISOString())}–${fmtTime(t.endsAt.toISOString())}` : '—',
    ],
    ['Where', draftWhere(d)],
    ['Tickets', d.capacity ? `${price} · ${d.capacity} places` : `${price} · no limit`],
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

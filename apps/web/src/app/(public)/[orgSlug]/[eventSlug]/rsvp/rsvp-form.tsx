'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, Stepper } from '@/components/controls';
import { Cover } from '@/components/cover';
import { Icon } from '@/components/icons';
import { apiClient, ApiError } from '@/lib/api-client';
import { fmtDay, fmtTime, fmtWhen } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';
import { EmptyState, Skeleton } from '@/components/ui';

const MAX = 10;

type RsvpEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  href: string;
  coverImageUrl: string | null;
  category: string;
  place: string;
  venueLine: string;
  host: string;
  tierName: string;
  tierDescription: string | null;
  remaining: number | null;
};

export function RsvpForm({ event, initialQty }: { event: RsvpEvent; initialQty: number }) {
  const { user, ready } = useRequireSession();
  // One RSVP per person per event (the API answers a second with 409) — say
  // so up front instead of after they've filled the form in.
  const mine = useApi<Ticket[]>(ready ? '/v1/me/tickets' : null);
  const cap = Math.max(1, Math.min(MAX, event.remaining ?? MAX));
  const [qty, setQty] = useState(Math.min(Math.max(1, initialQty), cap));
  const [name, setName] = useState('');
  useEffect(() => {
    if (user?.name) setName((n) => n || user.name);
  }, [user?.name]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ticketId: string; count: number; code: string } | null>(null);

  const when = `${fmtDay(event.startsAt, event.timezone)} · ${fmtTime(event.startsAt, event.timezone)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await apiClient<{ tickets: { id: string; code: string }[] }>(`/v1/events/${event.id}/rsvp`, {
        method: 'POST',
        body: { quantity: qty, ...(name.trim() ? { attendeeName: name.trim() } : {}) },
      });
      const first = res.tickets[0]!;
      setDone({ ticketId: first.id, count: res.tickets.length, code: first.code });
      // The confirmation replaces the form; start it from the top of the page.
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t reserve your place. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const existing = mine.data?.filter((t) => t.event.id === event.id) ?? [];

  if (!done && (!ready || mine.status === 'loading')) {
    return (
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_380px]" aria-busy="true">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!done && existing.length > 0) {
    return (
      <EmptyState
        icon="ticket"
        title="You’re already going"
        body={`You have ${existing.length === 1 ? 'a ticket' : `${existing.length} tickets`} for ${event.title}.`}
        action={
          <Link href={`/me/tickets/${existing[0]!.id}` as never} className="btn btn-primary">
            View your ticket
          </Link>
        }
      />
    );
  }

  if (done) return <Confirmation event={event} done={done} />;

  return (
    <form onSubmit={submit} className="grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2.5">
          <span className="eyebrow text-accent">Reserve a place</span>
          <h1 className="h1 !text-[44px]">{event.title}</h1>
          <p className="text-[15px] text-ink-2">
            {when} · {event.place}
          </p>
        </div>

        <section className="card flex flex-col gap-5 p-6">
          <h2 className="text-[20px] text-strong">How many places?</h2>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line-3 bg-softer p-4">
            <span className="flex flex-col gap-1">
              <span className="text-[16px]">{event.tierName}</span>
              <span className="text-[13px] text-muted">
                {['Free', event.tierDescription, event.remaining !== null ? `${event.remaining} left` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <Stepper
              value={qty}
              min={1}
              max={cap}
              onChange={setQty}
              label="Number of places"
              decLabel="Remove a place"
              incLabel="Add a place"
            />
          </div>
          <p className="text-[13px] text-faint">Up to {cap} per booking. Each place gets its own QR ticket.</p>
        </section>

        {/* TODO(confirm): the design asks for a name per place ("Who’s coming
            with you?") and a "Remind me 24 hours before" switch. The API takes
            one name for the whole booking, and reminders are an account
            setting, so neither is shown here. */}
        <section className="card flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] text-strong">Name on the booking</h2>
            <p className="text-[14px] text-muted">The host sees this on their attendee list and at the door.</p>
          </div>
          <Field label="Your name">
            {(p) => (
              <input
                {...p}
                className="input"
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            )}
          </Field>
        </section>
      </div>

      <aside className="panel flex flex-col gap-4 p-6 lg:sticky lg:top-24">
        <div className="relative h-[150px] overflow-hidden rounded-2xl bg-surface-2">
          <Cover image={event.coverImageUrl} category={event.category} title={event.title} />
        </div>
        <span className="eyebrow text-ink-2">{fmtWhen(event.startsAt, event.timezone)}</span>
        <span className="text-[20px] leading-tight text-strong">{event.title}</span>
        <span className="text-[14px] text-muted">{event.host}</span>
        <div className="rule-x my-2" />
        <div className="flex items-center justify-between text-[15px]" aria-live="polite">
          <span className="text-ink-2">{qty === 1 ? '1 place' : `${qty} places`}</span>
          <span className="text-ink">Free</span>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
          {pending ? 'Reserving…' : 'Confirm places'}
        </button>
        <p className="text-center text-[12px] text-faint">You can cancel any time from Your tickets.</p>
      </aside>
    </form>
  );
}

/** The design's RSVP confirmation: shown in place once the places are reserved. */
function Confirmation({
  event,
  done,
}: {
  event: RsvpEvent;
  done: { ticketId: string; count: number; code: string };
}) {
  const [copied, setCopied] = useState(false);
  const places = done.count === 1 ? 'One place' : `${done.count} places`;
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: event.timezone })
    .format(new Date(event.startsAt))
    .toUpperCase();
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: event.timezone }).format(
    new Date(event.startsAt),
  );

  async function share() {
    const url = `${window.location.origin}${event.href}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="relative -mx-5 overflow-hidden px-5 pb-16 pt-6 sm:-mx-8 sm:px-8" role="status">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-160px] -ml-[410px] h-[820px] w-[820px] rounded-full blur-[30px]"
        style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.16), transparent 65%)' }}
      />
      <div className="relative mx-auto flex max-w-[620px] flex-col items-center gap-4 text-center">
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
          <Icon name="check" size={34} />
        </span>
        <h1 className="display !text-[42px] sm:!text-[56px]">You’re going</h1>
        <p className="lead">
          {places} at {event.title}. Your tickets are ready — we’ve emailed you a confirmation.
        </p>

        <div className="mt-4 w-full rounded-[24px] border border-line-2 bg-surface p-6 text-left shadow-panel">
          <div className="flex items-center gap-5">
            <span className="flex h-[72px] w-[72px] flex-none flex-col items-center justify-center rounded-2xl border border-line-2 bg-raised">
              <span className="eyebrow text-[10px] text-accent">{month}</span>
              <span className="text-[26px] leading-none text-strong">{day}</span>
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[20px] text-strong">{event.title}</span>
              <span className="text-[14px] text-muted">
                {fmtDay(event.startsAt, event.timezone)} · {fmtTime(event.startsAt, event.timezone)} · {event.place}
              </span>
            </span>
          </div>
          <div className="rule-x my-5" />
          <dl className="flex flex-col gap-2.5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Tickets</dt>
              <dd>
                {done.count} × {event.tierName}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Price</dt>
              <dd>Free</dd>
            </div>
            {/* TODO(confirm): RSVPs have no booking reference, so this is the
                first ticket's code. */}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Reference</dt>
              <dd className="font-mono">{done.code}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link
            href={(done.count === 1 ? `/me/tickets/${done.ticketId}` : '/me/tickets') as never}
            className="btn btn-primary btn-lg"
          >
            View tickets
          </Link>
          <button type="button" className="btn btn-outline btn-lg" onClick={() => downloadIcs(event, done.ticketId)}>
            Add to calendar
          </button>
          <button type="button" className="btn btn-outline btn-lg" onClick={() => void share()}>
            {copied ? 'Link copied' : 'Share with a friend'}
          </button>
        </div>
        <Link href="/events" className="mt-2 text-[14px] text-ink-2 hover:text-accent">
          Back to Discover
        </Link>
      </div>
    </div>
  );
}

function downloadIcs(event: RsvpEvent, uid: string) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const url = `${window.location.origin}${event.href}`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ekklesia//Tickets//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@ekklesia`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${esc(event.title)}`,
    `LOCATION:${esc(event.venueLine)}`,
    `DESCRIPTION:${esc(`Hosted by ${event.host}. ${url}`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'event.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}

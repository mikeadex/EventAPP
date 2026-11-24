'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, Stepper } from '@/components/controls';
import { Icon } from '@/components/icons';
import { apiClient, ApiError } from '@/lib/api-client';
import { fmtDay, fmtTime } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';
import { EmptyState, Skeleton } from '@/components/ui';

const MAX = 10;

export function RsvpForm({
  event,
  initialQty,
}: {
  event: {
    id: string;
    title: string;
    startsAt: string;
    timezone: string;
    place: string;
    host: string;
    tierName: string;
    remaining: number | null;
  };
  initialQty: number;
}) {
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
  const [done, setDone] = useState<{ ticketId: string; count: number } | null>(null);

  const when = `${fmtDay(event.startsAt, event.timezone)} · ${fmtTime(event.startsAt, event.timezone)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await apiClient<{ tickets: { id: string }[] }>(`/v1/events/${event.id}/rsvp`, {
        method: 'POST',
        body: { quantity: qty, ...(name.trim() ? { attendeeName: name.trim() } : {}) },
      });
      setDone({ ticketId: res.tickets[0]!.id, count: res.tickets.length });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t reserve your place. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const existing = mine.data?.filter((t) => t.event.id === event.id) ?? [];

  if (!done && (!ready || mine.status === 'loading')) {
    return (
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_380px]" aria-busy="true">
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

  if (done) {
    return (
      <div className="panel mx-auto flex max-w-[560px] flex-col items-center gap-5 !rounded-hero p-10 text-center" role="status">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
          <Icon name="check" size={28} />
        </span>
        <span className="eyebrow text-accent">You’re going</span>
        <h1 className="text-[32px] leading-tight text-strong">{event.title}</h1>
        <p className="text-[15px] text-body">
          {when} · {event.place}
        </p>
        <p className="text-[15px] text-ink-2">
          {done.count === 1 ? 'Your ticket is ready.' : `${done.count} tickets are ready.`} We’ve emailed you a
          confirmation too.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href={`/me/tickets/${done.ticketId}` as never} className="btn btn-primary btn-lg">
            <Icon name="ticket" /> Show my ticket
          </Link>
          <Link href="/events" className="btn btn-outline btn-lg">
            Discover more
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="eyebrow text-accent">Reserve a place</span>
          <h1 className="h1 !text-[44px]">{event.title}</h1>
          <p className="text-[15px] text-body">
            {when} · {event.place}
          </p>
        </div>

        <section className="card flex flex-col gap-5 p-6">
          <h2 className="text-[20px] text-strong">How many places?</h2>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line-3 bg-softer p-4">
            <span className="flex flex-col gap-1">
              <span className="text-[16px]">{event.tierName}</span>
              <span className="text-[13px] text-muted">
                Free{event.remaining !== null ? ` · ${event.remaining} left` : ''}
              </span>
            </span>
            <Stepper value={qty} min={1} max={cap} onChange={setQty} label="Places" />
          </div>
          <p className="text-[13px] text-faint">Up to {cap} per booking. Each place gets its own QR ticket.</p>
        </section>

        <section className="card flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] text-strong">Name on the booking</h2>
            <p className="text-[14px] text-body">The host sees this on their attendee list and at the door.</p>
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
                placeholder="First and last name"
              />
            )}
          </Field>
        </section>
      </div>

      <aside className="panel flex flex-col gap-4 p-6 md:sticky md:top-24">
        <span className="eyebrow text-[10px] text-faint">{when}</span>
        <span className="text-[20px] leading-tight text-strong">{event.title}</span>
        <span className="text-[14px] text-muted">{event.host}</span>
        <div className="rule-x my-2" />
        <div className="flex items-center justify-between" aria-live="polite">
          <span className="text-[15px] text-ink-2">{qty === 1 ? '1 place' : `${qty} places`}</span>
          <span className="text-[22px] text-strong">Free</span>
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

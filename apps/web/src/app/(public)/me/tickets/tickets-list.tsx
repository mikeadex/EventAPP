'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cover } from '@/components/cover';
import { EmptyState, ErrorCard, Eyebrow, Skeleton } from '@/components/ui';
import { fmtDayMonth, fmtTime, fmtWhen, ticketsLabel, ticketsPrice } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';

type Tab = 'upcoming' | 'past';

/** One row per event: several places booked together share a row. */
function groupByEvent(tickets: Ticket[]) {
  const map = new Map<string, Ticket[]>();
  for (const t of tickets) map.set(t.event.id, [...(map.get(t.event.id) ?? []), t]);
  return [...map.values()];
}

export function TicketsList() {
  const { ready } = useRequireSession();
  const tickets = useApi<Ticket[]>(ready ? '/v1/me/tickets' : null);
  const [tab, setTab] = useState<Tab>('upcoming');

  const now = Date.now();
  const groups = tickets.data ? groupByEvent(tickets.data) : [];
  const upcoming = groups.filter((g) => new Date(g[0]!.event.endsAt).getTime() >= now);
  const past = groups.filter((g) => new Date(g[0]!.event.endsAt).getTime() < now).reverse();
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Eyebrow>Tickets</Eyebrow>
          <h1 className="h1">Your tickets</h1>
        </div>
        <div role="tablist" aria-label="Ticket list" className="flex gap-2">
          {(
            [
              ['upcoming', `Upcoming${tickets.data ? ` · ${upcoming.length}` : ''}`],
              ['past', `Past${tickets.data ? ` · ${past.length}` : ''}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className="chip"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tickets.status === 'loading' ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-card" />
          ))}
        </div>
      ) : tickets.status === 'error' ? (
        <ErrorCard
          message={tickets.error}
          action={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void tickets.reload()}>
              Try again
            </button>
          }
        />
      ) : shown.length === 0 ? (
        tab === 'upcoming' ? (
          <EmptyState
            icon="ticket"
            title="No upcoming tickets"
            body="When you reserve a place, your ticket and QR code live here."
            action={
              <Link href="/events" className="btn btn-primary">
                Discover events
              </Link>
            }
          />
        ) : (
          <EmptyState icon="calendar" title="Nothing here yet" body="Events you’ve been to will show up here." />
        )
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((g) => (
            <TicketRow key={g[0]!.event.id} tickets={g} past={tab === 'past'} />
          ))}
        </ul>
      )}

      <p className="mt-8 text-[14px] text-faint">
        Tickets are also in the Ekklesia app and in your confirmation emails.{' '}
        <Link href="/saved" className="text-accent">
          See saved events →
        </Link>
      </p>
    </>
  );
}

function TicketRow({ tickets, past }: { tickets: Ticket[]; past: boolean }) {
  const t = tickets[0]!;
  const e = t.event;
  const href = `/me/tickets/${t.id}`;
  const scanned = tickets.find((x) => x.status === 'CHECKED_IN');
  const place = e.isOnline ? 'Online' : e.venue ? e.venue.name : 'Venue to be confirmed';
  const status = scanned
    ? `Checked in${scanned.checkedInAt ? ` · ${fmtDayMonth(scanned.checkedInAt, e.timezone)}, ${fmtTime(scanned.checkedInAt, e.timezone)}` : ''}`
    : past
      ? 'Event ended'
      : 'Valid · active on the day';
  return (
    <li className="card card-link grid overflow-hidden sm:grid-cols-[280px_minmax(0,1fr)_auto]">
      <Link
        href={href as never}
        tabIndex={-1}
        aria-hidden="true"
        className={`relative block min-h-[180px] bg-surface-2 ${past ? 'opacity-[.55]' : ''}`}
      >
        <Cover image={e.coverImageUrl} category="OTHER" title={e.title} />
      </Link>
      <div className="flex min-w-0 flex-col gap-2 p-6">
        <span className="eyebrow text-ink-2">{fmtWhen(e.startsAt, e.timezone)}</span>
        <h2 className="text-[24px] leading-[1.2] text-strong [overflow-wrap:anywhere]">
          <Link href={href as never}>{e.title}</Link>
        </h2>
        <p className="text-[15px] text-muted">
          {e.organization.name} · {place}
        </p>
        <p className="mt-2 flex flex-wrap gap-2">
          <span className="tag">{ticketsLabel(tickets.length, t.ticketType)}</span>
          <span className="tag !border-line !text-ink-2">{ticketsPrice(tickets.length, t.ticketType)}</span>
        </p>
      </div>
      <div className="flex min-w-[220px] flex-col justify-between gap-4 border-t border-dashed border-line-2 p-6 sm:border-l sm:border-t-0">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-[10px] text-faint">Ticket code</span>
          <span className="font-mono text-[15px] tracking-[0.08em] text-strong">{t.code}</span>
          <span className={`flex items-center gap-2 text-[13px] ${past || scanned ? 'text-muted' : 'text-accent'}`}>
            <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
            {status}
          </span>
        </div>
        {/* TODO(confirm): the design's past rows say "View receipt"; free
            RSVPs have no order or receipt, so they open the ticket. */}
        <Link href={href as never} className="btn btn-primary">
          {past ? 'View ticket' : 'View QR ticket'}
        </Link>
      </div>
    </li>
  );
}

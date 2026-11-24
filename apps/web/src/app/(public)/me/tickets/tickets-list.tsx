'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cover } from '@/components/cover';
import { Icon } from '@/components/icons';
import { EmptyState, ErrorCard, PageIntro, Skeleton } from '@/components/ui';
import { fmtDay, fmtTime, plural } from '@/lib/format';
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
      <PageIntro eyebrow="Your tickets" title="Where you’re going" />

      <div role="tablist" aria-label="Tickets" className="mb-8 flex gap-2">
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

      {tickets.status === 'loading' ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[120px] w-full rounded-card" />
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
    </>
  );
}

function TicketRow({ tickets, past }: { tickets: Ticket[]; past: boolean }) {
  const t = tickets[0]!;
  const e = t.event;
  const checkedIn = tickets.filter((x) => x.status === 'CHECKED_IN').length;
  const place = e.isOnline ? 'Online' : e.venue ? `${e.venue.name}, ${e.venue.city}` : 'Venue to be confirmed';
  return (
    <li className="card card-link relative flex items-center gap-5 p-4 sm:p-5">
      <div className="relative hidden h-[88px] w-[132px] flex-none overflow-hidden rounded-2xl bg-surface-2 sm:block">
        <Cover image={e.coverImageUrl} category="OTHER" title={e.title} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="eyebrow text-[11px] text-ink-2">
          {fmtDay(e.startsAt, e.timezone)} · {fmtTime(e.startsAt, e.timezone)}
        </span>
        <h2 className="truncate text-[20px] leading-tight text-strong">
          <Link href={`/me/tickets/${t.id}` as never} className="after:absolute after:inset-0">
            {e.title}
          </Link>
        </h2>
        <p className="truncate text-[14px] text-muted">
          {e.organization.name} · {place}
        </p>
        <p className="flex flex-wrap items-center gap-2 pt-1 text-[13px]">
          <span className="font-mono text-faint">{t.code}</span>
          {tickets.length > 1 && <span className="tag-muted">{plural(tickets.length, 'place')}</span>}
          {checkedIn > 0 && <span className="tag">Checked in</span>}
        </p>
      </div>
      {!past && (
        <span className="btn btn-outline btn-sm hidden flex-none md:inline-flex" aria-hidden="true">
          <Icon name="ticket" size={16} /> Show ticket
        </span>
      )}
      <Icon name="arrowRight" className="flex-none text-faint md:hidden" />
    </li>
  );
}

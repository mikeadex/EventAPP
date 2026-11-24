'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SwitchRow } from '@/components/controls';
import { Icon, type IconName } from '@/components/icons';
import { BackLink, EmptyState, ErrorCard, Eyebrow, Row, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { fmtDateLong, fmtDateShort, fmtTime, mapsUrl, ticketsLabel, ticketsPrice } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';
import { eventHref, safeHttpUrl } from '@/lib/url';
import { TicketQr } from './ticket-qr';

/** A calendar file built in the browser — no extra endpoint needed. */
function downloadIcs(t: Ticket) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const e = t.event;
  const where = e.isOnline
    ? (e.onlineUrl ?? 'Online')
    : e.venue
      ? [e.venue.name, e.venue.addressLine1, e.venue.city, e.venue.postalCode].filter(Boolean).join(', ')
      : '';
  const url = `${window.location.origin}${eventHref(e)}`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ekklesia//Tickets//EN',
    'BEGIN:VEVENT',
    `UID:${t.id}@ekklesia`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`Hosted by ${e.organization.name}. Ticket ${t.code}. ${url}`)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${e.slug}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const GRID = 'grid items-start gap-12 min-[901px]:grid-cols-[minmax(0,440px)_minmax(0,1fr)]';

/** One of the design's action tiles: icon and label in a bordered row. */
function Action({
  icon,
  children,
  ...rest
}: { icon: IconName; children: React.ReactNode } & (
  | { href: string; external?: boolean; onClick?: never }
  | { onClick: () => void; href?: never; external?: never }
)) {
  const cls =
    'flex items-center gap-3.5 rounded-2xl border border-line bg-surface px-[18px] py-4 text-left text-[15px] text-ink transition-colors hover:border-line-2';
  const inner = (
    <>
      <Icon name={icon} size={20} className="flex-none text-accent" />
      {children}
    </>
  );
  if (rest.onClick) {
    return (
      <button type="button" className={cls} onClick={rest.onClick}>
        {inner}
      </button>
    );
  }
  return rest.external ? (
    <a href={rest.href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={rest.href as never} className={cls}>
      {inner}
    </Link>
  );
}

export function TicketView({ ticketId }: { ticketId: string }) {
  const { ready } = useRequireSession();
  const router = useRouter();
  const ticket = useApi<Ticket>(ready ? `/v1/tickets/${ticketId}` : null);
  // The other places booked with this one: the API allows one RSVP per person
  // per event, so the user's tickets for the same event are one booking.
  const mine = useApi<Ticket[]>(ready ? '/v1/me/tickets' : null);
  const [visError, setVisError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (ticket.status === 'loading') {
    return (
      <div className={GRID} aria-busy="true">
        <Skeleton className="h-[640px] rounded-hero" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (ticket.status === 'error') {
    return ticket.error.toLowerCase().includes('not found') ? (
      <EmptyState
        icon="ticket"
        title="Ticket not found"
        body="It may belong to a different account."
        action={
          <Link href="/me/tickets" className="btn btn-primary">
            Your tickets
          </Link>
        }
      />
    ) : (
      <ErrorCard
        message={ticket.error}
        action={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void ticket.reload()}>
            Try again
          </button>
        }
      />
    );
  }

  const t = ticket.data;
  const e = t.event;
  const tz = e.timezone;
  const ended = new Date(e.endsAt).getTime() < Date.now();
  const cancelled = t.status === 'CANCELLED';
  const checkedIn = t.status === 'CHECKED_IN';
  const usable = !cancelled && !ended;
  const siblings =
    mine.status === 'ready'
      ? mine.data.filter((x) => x.event.id === e.id && x.status !== 'CANCELLED')
      : [];
  const booked = Math.max(siblings.length, 1);
  const place = e.isOnline
    ? 'Online'
    : e.venue
      ? [e.venue.name, e.venue.addressLine1, [e.venue.city, e.venue.postalCode].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ')
      : 'Venue to be confirmed';
  const status = cancelled
    ? 'Cancelled'
    : checkedIn
      ? `Checked in${t.checkedInAt ? ` · ${fmtTime(t.checkedInAt, tz)}` : ''}`
      : ended
        ? 'Event ended'
        : 'Valid · one scan per ticket';

  async function setVisible(show: boolean) {
    setVisError(null);
    ticket.mutate((p) => ({ ...p, showAsAttending: show }));
    try {
      await apiClient(`/v1/tickets/${t.id}/visibility`, { method: 'PATCH', body: { showAsAttending: show } });
    } catch {
      ticket.mutate((p) => ({ ...p, showAsAttending: !show }));
      setVisError('We couldn’t save that. Try again.');
    }
  }

  async function cancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await apiClient(`/v1/tickets/${t.id}`, { method: 'DELETE' });
      router.replace('/me/tickets' as never);
    } catch (err) {
      setCancelling(false);
      setCancelError(err instanceof ApiError ? err.message : 'We couldn’t cancel your place.');
    }
  }

  return (
    <>
      <BackLink href="/me/tickets">Your tickets</BackLink>
      <div className={GRID}>
        {/* The ticket itself */}
        <article aria-label="Ticket" className="panel overflow-hidden !rounded-hero px-7 py-8 text-center">
          <span className="eyebrow tracking-[0.3em] text-ink-2">{e.organization.name}</span>
          <h1 className="mt-2.5 text-[32px] leading-[1.15] text-strong [overflow-wrap:anywhere]">{e.title}</h1>
          <p className="mt-4 text-[15px] text-body">Ticket will be active from</p>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-left">
            <div className="flex flex-col gap-1">
              <span className="eyebrow text-[10px] text-faint">Starts</span>
              <span className="text-[30px] leading-none text-strong">{fmtTime(e.startsAt, tz)}</span>
              <span className="text-[13px] text-muted">{fmtDateShort(e.startsAt, tz)}</span>
            </div>
            <Icon name="arrowRight" size={18} className="text-faint" />
            <div className="flex flex-col gap-1">
              <span className="eyebrow text-[10px] text-faint">Ends</span>
              <span className="text-[30px] leading-none text-strong">{fmtTime(e.endsAt, tz)}</span>
              <span className="text-[13px] text-muted">{fmtDateShort(e.endsAt, tz)}</span>
            </div>
          </div>

          <div className="relative -mx-7 my-7 border-t border-dashed border-line-2" aria-hidden="true">
            <span className="absolute -left-3.5 -top-3.5 h-7 w-7 rounded-full bg-bg" />
            <span className="absolute -right-3.5 -top-3.5 h-7 w-7 rounded-full bg-bg" />
          </div>

          {siblings.length > 1 && (
            <div role="tablist" aria-label="Tickets in this booking" className="mb-5 flex flex-wrap justify-center gap-2">
              {siblings.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={s.id === t.id}
                  className="chip"
                  onClick={() => s.id !== t.id && router.replace(`/me/tickets/${s.id}` as never, { scroll: false })}
                >
                  Ticket {i + 1} of {siblings.length}
                </button>
              ))}
            </div>
          )}

          <div
            role="img"
            aria-label={`QR code for ticket ${t.code}`}
            className={`mx-auto inline-flex rounded-[20px] bg-white p-[18px] ${usable ? '' : 'opacity-30'}`}
          >
            <TicketQr value={t.code} size={200} />
          </div>
          <p className="mt-[18px] font-mono text-[18px] tracking-[0.22em] text-strong">{t.code}</p>
          <p className="mt-1.5 text-[13px] tracking-[0.12em] text-faint">Show at registration</p>
          {t.attendeeName && <p className="mt-1 text-[14px] text-ink-2">{t.attendeeName}</p>}
          <p
            className={`mt-[18px] inline-flex items-center gap-2 text-[15px] ${usable && !checkedIn ? 'text-ink' : 'text-muted'}`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${usable && !checkedIn ? 'bg-accent' : 'bg-muted'}`}
            />
            {status}
          </p>
          {cancelled && <p className="mt-1 text-[13px] text-muted">This place was cancelled and can’t be used.</p>}
          <p className="mt-1.5 text-[15px] text-ink-2">{place}</p>

          {!cancelled && (
            <>
              <div className="rule-x my-6" />
              <div className="text-left">
                {/* TODO(confirm): the design's hint is the shorter "Visible on
                    the event page". This keeps the opt-in explanation until
                    the owner confirms the wording. */}
                <SwitchRow
                  title="Show me as going"
                  hint="Your name and photo appear on the event page’s “Who’s going” list. You can turn this off any time."
                  checked={t.showAsAttending}
                  onChange={(v) => void setVisible(v)}
                />
                {visError && (
                  <p role="alert" className="error-text mt-2">
                    {visError}
                  </p>
                )}
              </div>
            </>
          )}
        </article>

        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-2">
            <Eyebrow>{fmtDateLong(e.startsAt, tz)}</Eyebrow>
            <h2 className="text-[26px] leading-tight text-strong">
              Keep this handy — the host scans the code at the door.
            </h2>
            <p className="text-[15px] leading-[1.6] text-body">
              Your ticket code is also in your confirmation email and the Ekklesia app.
            </p>
          </div>

          {/* TODO(confirm docs/04 #14): the design also has Add to Apple
              Wallet, Add to Google Wallet and Download PDF. There are no
              wallet passes or PDFs yet, so they're left out. */}
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {usable && (
              <Action icon="calendar" onClick={() => downloadIcs(t)}>
                Add to calendar
              </Action>
            )}
            {usable && !e.isOnline && e.venue && (
              <Action icon="pin" href={mapsUrl(e.venue)} external>
                Get directions
              </Action>
            )}
            {usable && e.isOnline && safeHttpUrl(e.onlineUrl) && (
              <Action icon="globe" href={safeHttpUrl(e.onlineUrl)!} external>
                Join online
              </Action>
            )}
            <Action icon="external" href={eventHref(e)}>
              Event details
            </Action>
          </div>

          <section aria-label="Booking" className="card flex flex-col gap-3.5 p-6">
            <span className="eyebrow text-[10px] text-faint">Booking</span>
            {/* Free RSVPs have no booking reference of their own, so the
                ticket code stands in for it. */}
            <Row k="Reference" v={t.code} mono />
            <Row k="Name" v={t.attendeeName ?? '—'} />
            <Row k="Tickets" v={ticketsLabel(booked, t.ticketType)} />
            <Row k="Paid" v={ticketsPrice(booked, t.ticketType)} />
            <div className="rule-x my-1" />
            {cancelError && (
              <p role="alert" className="error-text">
                {cancelError}
              </p>
            )}
            {confirming ? (
              <div className="flex flex-col gap-3">
                <p className="text-[14px] text-body">
                  Cancelling frees your place for someone else. This can’t be undone.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button type="button" className="btn btn-primary btn-sm" disabled={cancelling} onClick={() => void cancel()}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel my place'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(false)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {/* TODO(confirm): the design has "Transfer a ticket"; there's
                    no way to transfer a ticket yet. */}
                {usable && !checkedIn && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(true)}>
                    Cancel my place
                  </button>
                )}
                <Link href={`/${e.organization.slug}` as never} className="btn btn-sm border border-line-3 text-accent">
                  Contact the host
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SwitchRow } from '@/components/controls';
import { Icon } from '@/components/icons';
import { BackLink, EmptyState, ErrorCard, Row, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { fmtDateLong, fmtTime, mapsUrl } from '@/lib/format';
import type { Ticket } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';
import { eventHref, safeHttpUrl } from '@/lib/url';
import { TicketQr } from './ticket-qr';

const STATUS: Record<string, string> = {
  ISSUED: 'Valid',
  CHECKED_IN: 'Checked in',
  CANCELLED: 'Cancelled',
  RESERVED: 'Reserved',
  REFUNDED: 'Refunded',
  EXPIRED: 'Expired',
};

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

export function TicketView({ ticketId }: { ticketId: string }) {
  const { ready } = useRequireSession();
  const router = useRouter();
  const ticket = useApi<Ticket>(ready ? `/v1/tickets/${ticketId}` : null);
  const [visError, setVisError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (ticket.status === 'loading') {
    return (
      <div className="grid gap-10 md:grid-cols-[400px_minmax(0,1fr)]" aria-busy="true">
        <Skeleton className="h-[560px] rounded-hero" />
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
      <ErrorCard message={ticket.error} />
    );
  }

  const t = ticket.data;
  const e = t.event;
  const ended = new Date(e.endsAt).getTime() < Date.now();
  const cancelled = t.status === 'CANCELLED';
  const checkedIn = t.status === 'CHECKED_IN';
  const usable = !cancelled && !ended;

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
      <div className="grid items-start gap-10 md:grid-cols-[400px_minmax(0,1fr)]">
        {/* The ticket itself */}
        <section aria-label="Ticket" className="panel overflow-hidden !rounded-hero">
          <div className="flex flex-col gap-2 p-7 text-center">
            <span className="eyebrow text-accent">{e.organization.name}</span>
            <h1 className="text-[26px] leading-tight text-strong">{e.title}</h1>
            <p className="text-[14px] text-body">
              {fmtDateLong(e.startsAt, e.timezone)} · {fmtTime(e.startsAt, e.timezone)}
            </p>
          </div>
          <div className="relative border-t border-dashed border-line-2">
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-bg" aria-hidden="true" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-bg" aria-hidden="true" />
          </div>
          <div className="flex flex-col items-center gap-4 p-7">
            <div className={`rounded-2xl bg-white p-4 ${usable ? '' : 'opacity-30'}`}>
              <TicketQr value={t.code} size={208} />
            </div>
            <p className="font-mono text-[15px] tracking-[0.14em] text-strong">{t.code}</p>
            <span className={checkedIn || !usable ? 'tag-muted' : 'tag'}>
              {ended && !cancelled && !checkedIn ? 'Event ended' : (STATUS[t.status] ?? t.status)}
            </span>
            <p className="text-center text-[13px] leading-relaxed text-muted">
              {cancelled
                ? 'This place was cancelled and can’t be used.'
                : checkedIn
                  ? `Scanned at the door${t.checkedInAt ? ` at ${fmtTime(t.checkedInAt, e.timezone)}` : ''}.`
                  : 'Show this code at the door. Turn your brightness up — each code scans once.'}
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <Link href={eventHref(e) as never} className="btn btn-outline">
              <Icon name="external" size={16} /> Event page
            </Link>
            {usable && (
              <button type="button" className="btn btn-outline" onClick={() => downloadIcs(t)}>
                <Icon name="calendar" size={16} /> Add to calendar
              </button>
            )}
            {usable && !e.isOnline && e.venue && (
              <a href={mapsUrl(e.venue)} target="_blank" rel="noreferrer" className="btn btn-outline">
                <Icon name="pin" size={16} /> Directions
              </a>
            )}
            {usable && e.isOnline && safeHttpUrl(e.onlineUrl) && (
              <a href={safeHttpUrl(e.onlineUrl)!} target="_blank" rel="noreferrer" className="btn btn-primary">
                <Icon name="globe" size={16} /> Join online
              </a>
            )}
          </div>

          <section className="card flex flex-col gap-4 p-6">
            <h2 className="text-[20px] text-strong">Booking</h2>
            <Row k="Name" v={t.attendeeName ?? '—'} />
            <Row k="Ticket code" v={t.code} mono />
            <Row k="Status" v={STATUS[t.status] ?? t.status} />
            <Row
              k={e.isOnline ? 'Where' : 'Venue'}
              v={
                e.isOnline
                  ? 'Online'
                  : e.venue
                    ? `${e.venue.name}, ${e.venue.addressLine1}, ${e.venue.city} ${e.venue.postalCode}`
                    : 'To be confirmed'
              }
            />
            <Row k="Price" v="Free" />
          </section>

          {!cancelled && (
            <section className="card flex flex-col gap-3 p-6">
              <SwitchRow
                title="Show me as going"
                hint="Your name and photo appear on the event page’s “Who’s going” list. You can turn this off any time."
                checked={t.showAsAttending}
                onChange={(v) => void setVisible(v)}
              />
              {visError && (
                <p role="alert" className="error-text">
                  {visError}
                </p>
              )}
            </section>
          )}

          {usable && !checkedIn && (
            <section className="card flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] text-strong">Can’t make it?</h2>
                <p className="text-[14px] text-body">
                  Cancelling frees your place for someone else. This can’t be undone.
                </p>
              </div>
              {cancelError && (
                <p role="alert" className="error-text">
                  {cancelError}
                </p>
              )}
              {confirming ? (
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn btn-primary" disabled={cancelling} onClick={() => void cancel()}>
                    {cancelling ? 'Cancelling…' : 'Yes, cancel my place'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-outline self-start" onClick={() => setConfirming(true)}>
                  Cancel my place
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}

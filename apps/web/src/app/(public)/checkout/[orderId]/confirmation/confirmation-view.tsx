'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { EmptyState, Skeleton } from '@/components/ui';
import { ApiError, apiClient } from '@/lib/api-client';
import { amount, fmtDay, fmtTime } from '@/lib/format';
import { formatCountdown, getOrder, secondsUntil, syncOrder, type OrderDetail } from '@/lib/payments';
import type { Ticket } from '@/lib/types';
import { useRequireSession } from '@/lib/use-api';
import { DateTile, ticketsLine } from '../order-summary';

/**
 * Booking confirmation (Confirmation.dc.html) for a paid order: the `paid`
 * and `declined` states. Free RSVPs confirm in place on the RSVP page.
 *
 * Reached three ways: from checkout after the card confirmed in place; from
 * Stripe's redirect for methods that leave the page (`redirect_status` in the
 * query); and from checkout after a decline (`declined=1`). Whatever the
 * route, the order's own status decides what's shown — a refresh of the
 * declined page after a later successful payment shows the tickets.
 */
type View = 'loading' | 'paid' | 'declined' | 'confirming' | 'pending' | 'gone' | 'error';

const SYNC_TRIES = 5;

export function ConfirmationView({ orderId }: { orderId: string }) {
  const { ready } = useRequireSession();
  const params = useSearchParams();
  const declinedParam = params.get('declined') === '1' || params.get('redirect_status') === 'failed';
  const reason = params.get('reason');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [view, setView] = useState<View>('loading');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    try {
      let o = await getOrder(orderId);
      if (o.status !== 'PAID' && (o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT') && !declinedParam) {
        // The webhook may still be on its way: ask the server to check with
        // Stripe now, a few times, before giving up on this visit.
        setOrder(o);
        setView('confirming');
        for (let i = 0; i < SYNC_TRIES; i++) {
          const r = await syncOrder(orderId).catch(() => null);
          if (r?.status === 'PAID') break;
          await new Promise((res) => setTimeout(res, 1500));
        }
        o = await getOrder(orderId);
      }
      setOrder(o);
      if (o.status === 'PAID') {
        setView('paid');
        const mine = await apiClient<Ticket[]>('/v1/me/tickets').catch(() => []);
        setTickets(mine.filter((t) => t.event.id === o.event.id && t.status !== 'RESERVED' && t.status !== 'EXPIRED'));
      } else if (o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT') {
        setView(declinedParam && secondsUntil(o.expiresAt) > 0 ? 'declined' : declinedParam ? 'gone' : 'pending');
      } else {
        setView('gone');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t load this order.');
      setView('error');
    }
  }, [orderId, declinedParam]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (!order || view !== 'declined') return;
    const tick = () => {
      const s = secondsUntil(order.expiresAt);
      setLeft(s);
      if (s === 0) setView('gone');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order, view]);

  if (!ready || view === 'loading' || view === 'confirming') {
    return (
      <div className="wrap max-w-[620px] pt-16" aria-busy="true" role="status">
        {view === 'confirming' && (
          <p className="mb-6 text-center text-[15px] text-ink-2">Confirming your payment…</p>
        )}
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-20 w-20 !rounded-full" />
          <Skeleton className="h-14 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-4 h-48 w-full rounded-panel" />
        </div>
      </div>
    );
  }

  if (view === 'error' || !order) {
    return (
      <div className="wrap max-w-[720px] pt-10">
        <EmptyState icon="ticket" title="We couldn’t open this order" body={error ?? undefined} />
      </div>
    );
  }

  if (view === 'gone') {
    return (
      <div className="wrap max-w-[720px] pt-10">
        <EmptyState
          icon="clock"
          title={order.status === 'EXPIRED' || order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT' ? 'Your tickets were released' : `This order is ${order.status.toLowerCase()}`}
          body="Nothing was charged. Choose your tickets again to continue."
          action={
            <Link href="/events" className="btn btn-primary">
              Discover events
            </Link>
          }
        />
      </div>
    );
  }

  if (view === 'pending') {
    return (
      <div className="wrap max-w-[720px] pt-10">
        <EmptyState
          icon="clock"
          title="Still confirming your payment"
          body="Stripe has your payment but we haven’t heard back yet. Your tickets will appear under Your tickets shortly — nothing more to do."
          action={
            <Link href="/me/tickets" className="btn btn-primary">
              Your tickets
            </Link>
          }
        />
      </div>
    );
  }

  const declined = view === 'declined';
  const first = tickets?.[0];
  const ev = first?.event;
  const tz = ev?.timezone;
  const place = ev ? (ev.isOnline && !ev.venue ? 'Online' : ev.venue?.name) : null;
  const meta = [`${fmtDay(order.event.startsAt, tz)} · ${fmtTime(order.event.startsAt, tz)}`, place].filter(Boolean).join(' · ');
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const seats = count <= 10 ? `${words[count]} ${count === 1 ? 'ticket' : 'tickets'}` : `${count} tickets`;

  return (
    <div className="relative overflow-hidden px-5 pb-16 pt-16" role="status">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-160px] -ml-[410px] h-[820px] w-[820px] rounded-full blur-[30px]"
        style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.16), transparent 65%)' }}
      />
      <div className="relative mx-auto flex max-w-[620px] flex-col items-center gap-4 text-center">
        <span className="inline-flex h-20 w-20 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
          <Icon name={declined ? 'close' : 'check'} size={34} />
        </span>
        {declined ? (
          <>
            <span className="eyebrow text-accent">Payment</span>
            <h1 className="display !text-[36px] sm:!text-[48px]">Your card was declined</h1>
            <p className="lead">
              {reason ?? 'Your bank turned down the payment.'} Nothing has been charged and your tickets are still held.
            </p>
            <p className="inline-flex items-center gap-2 text-[14px] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Tickets held for <span className="font-mono">{formatCountdown(left)}</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="display !text-[42px] sm:!text-[56px]">You’re going</h1>
            <p className="lead">
              {seats} for {order.event.title}. Your QR tickets are ready — we’ve emailed your receipt.
            </p>
          </>
        )}

        <div className="mt-4 w-full rounded-panel border border-line-2 bg-surface p-6 text-left shadow-panel">
          <div className="flex items-center gap-5">
            <DateTile iso={order.event.startsAt} tz={tz} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[20px] leading-snug text-strong">{order.event.title}</span>
              <span className="text-[14px] text-muted">{meta}</span>
            </span>
          </div>
          <div className="rule-x my-5" />
          <dl className="flex flex-col gap-2.5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">Tickets</dt>
              <dd>{ticketsLine(order)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-2">{declined ? 'To pay' : 'Paid'}</dt>
              <dd>{amount(order.totalMinor, order.currency)}</dd>
            </div>
            {!declined && first && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Reference</dt>
                <dd className="font-mono">{first.code}</dd>
              </div>
            )}
          </dl>
        </div>

        {declined ? (
          <>
            <div className="mt-2 flex w-full flex-col gap-3">
              <Link href={`/checkout/${order.id}` as never} className="btn btn-primary btn-lg">
                Try another card
              </Link>
              <Link href="/events" className="btn btn-outline btn-lg">
                Discover events
              </Link>
            </div>
            <p className="mt-2 text-[14px] text-ink-2">
              Still stuck? Your bank can say why a payment was refused; the host can hold a place for you.
            </p>
          </>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link
                href={(first && count === 1 ? `/me/tickets/${first.id}` : '/me/tickets') as never}
                className="btn btn-primary btn-lg"
              >
                View tickets
              </Link>
              {ev && (
                <>
                  <button type="button" className="btn btn-outline btn-lg" onClick={() => downloadIcs(ev, order.id)}>
                    Add to calendar
                  </button>
                  <ShareButton href={`/${ev.organization.slug}/${ev.slug}`} title={ev.title} />
                </>
              )}
            </div>
            <Link href="/events" className="mt-2 text-[14px] text-ink-2 hover:text-accent">
              Back to Discover
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function ShareButton({ href, title }: { href: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
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
    <button type="button" className="btn btn-outline btn-lg" onClick={() => void share()}>
      {copied ? 'Link copied' : 'Share with a friend'}
    </button>
  );
}

function downloadIcs(ev: Ticket['event'], uid: string) {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const url = `${window.location.origin}/${ev.organization.slug}/${ev.slug}`;
  const location = ev.venue
    ? [ev.venue.name, ev.venue.addressLine1, ev.venue.city, ev.venue.postalCode].filter(Boolean).join(', ')
    : 'Online';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ekklesia//Tickets//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@ekklesia`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(ev.startsAt)}`,
    `DTEND:${stamp(ev.endsAt)}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(`Hosted by ${ev.organization.name}. ${url}`)}`,
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

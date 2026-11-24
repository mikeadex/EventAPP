'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Stepper } from '@/components/controls';
import { money } from '@/lib/format';
import type { TicketTypeData } from '@/lib/types';

const MAX_PER_BOOKING = 10;

/**
 * The booking panel. Free events book through RSVP; paid tiers are shown with
 * their prices but can't be bought on the web yet — the API only issues free
 * RSVPs (paid checkout returns 400), so offering a "Continue · £X" button
 * would lead straight to an error.
 */
export function BookingPanel({
  event,
}: {
  event: {
    id: string;
    status: string;
    ended: boolean;
    remaining: number | null;
    href: string;
    tiers: TicketTypeData[];
  };
}) {
  const paid = event.tiers.some((t) => t.priceMinor > 0);
  const cap = Math.min(MAX_PER_BOOKING, event.remaining ?? MAX_PER_BOOKING);
  const [qty, setQty] = useState(cap > 0 ? 1 : 0);
  const soldOut = event.remaining === 0;
  const closed = event.status === 'CANCELLED' || event.ended;

  if (closed) {
    return (
      <aside id="book" aria-label="Book" className="panel flex flex-col gap-3 p-6 lg:sticky lg:top-24">
        <h2 className="text-[22px] text-strong">
          {event.status === 'CANCELLED' ? 'This event was cancelled' : 'This event has ended'}
        </h2>
        <p className="text-[15px] leading-relaxed text-body">
          {event.status === 'CANCELLED'
            ? 'The host has cancelled this event. If you had a ticket, it no longer admits you.'
            : 'Bookings are closed. Find something else that’s coming up.'}
        </p>
        <Link href="/events" className="btn btn-outline mt-2">
          Discover events
        </Link>
      </aside>
    );
  }

  const freeTier = event.tiers[0];
  const tierName = freeTier?.name && freeTier.name !== 'RSVP' ? freeTier.name : 'Free place';

  return (
    <aside id="book" aria-label="Book" className="panel p-6 lg:sticky lg:top-24">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[22px] text-strong">{paid ? 'Tickets' : 'Reserve a place'}</h2>
        {paid && <span className="text-[13px] text-faint">{event.tiers[0]?.currency}</span>}
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {paid ? (
          event.tiers.map((t) => {
            const left = t.quantity - t.sold;
            return (
              <li key={t.id} className="flex items-center gap-4 rounded-2xl border border-line p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[16px]">{t.name}</span>
                  {t.description && <span className="text-[13px] text-muted">{t.description}</span>}
                  <span className="text-[15px] text-accent">{money(t.priceMinor, t.currency)}</span>
                </div>
                <span className="text-[13px] text-faint">{left <= 0 ? 'Sold out' : left < 20 ? `${left} left` : ''}</span>
              </li>
            );
          })
        ) : (
          <li
            className={`flex items-center gap-4 rounded-2xl border p-4 ${
              qty > 0 ? 'border-line-3 bg-softer' : 'border-line'
            }`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[16px]">{tierName}</span>
              <span className="text-[15px] text-accent">Free</span>
              {event.remaining !== null && event.remaining > 0 && event.remaining < 20 && (
                <span className="text-[12px] text-faint">Only {event.remaining} left</span>
              )}
              {soldOut && <span className="text-[12px] text-faint">Sold out</span>}
            </div>
            <Stepper value={qty} min={soldOut ? 0 : 1} max={cap} onChange={setQty} label={`${tierName} places`} />
          </li>
        )}
      </ul>

      <div className="rule-x my-6" />

      {paid ? (
        <>
          {/* TODO(confirm): online payments (docs/04 #3). The API has no
              checkout yet, so paid events can't be booked on the web. */}
          <span className="btn btn-lg btn-muted w-full">Tickets on sale soon</span>
          <p className="mt-4 text-center text-[12px] text-faint">
            Online payment isn’t available yet. Contact the host to book.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between" aria-live="polite">
            <span className="text-[15px] text-ink-2">{qty === 1 ? '1 place' : `${qty} places`}</span>
            <span className="text-[22px] text-strong">Free</span>
          </div>
          {soldOut ? (
            <span className="btn btn-lg btn-muted mt-5 w-full">Sold out</span>
          ) : qty === 0 ? (
            <span className="btn btn-lg btn-muted mt-5 w-full">Choose a ticket</span>
          ) : (
            <Link href={`${event.href}/rsvp?qty=${qty}` as never} className="btn btn-primary btn-lg mt-5 w-full">
              RSVP
            </Link>
          )}
          <p className="mt-4 text-center text-[12px] text-faint">
            Free to book · cancel any time from Your tickets
          </p>
        </>
      )}
    </aside>
  );
}

/** Fixed bottom bar on phones: price, places left and a jump to the panel. */
export function MobileBookingBar({ price, spots, closed }: { price: string; spots: string; closed: boolean }) {
  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line sm:hidden"
        style={{ background: 'rgba(var(--scrim), 0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <span className="flex flex-col">
            <span className="text-[17px] text-strong">{price}</span>
            <span className="text-[12px] text-accent">{closed ? 'Bookings closed' : spots}</span>
          </span>
          <a href="#book" className="btn btn-primary !h-12 !px-6">
            {closed ? 'Details' : price === 'Free' ? 'RSVP' : 'Tickets'}
          </a>
        </div>
      </div>
      <div className="h-[72px] sm:hidden" aria-hidden="true" />
    </>
  );
}

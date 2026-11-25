'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { Stepper } from '@/components/controls';
import { amount, money } from '@/lib/format';
import { availableOf, createOrder, PLATFORM_FEE_BPS, previewFee } from '@/lib/payments';
import type { TicketTypeData } from '@/lib/types';
import { signInHref } from '@/lib/url';

const MAX_PER_BOOKING = 10;

/**
 * The booking panel. Free events book through RSVP. Paid tiers get a stepper
 * each and "Continue" opens an order (`POST /v1/orders`, which holds the
 * tickets and quotes the real total) and goes to checkout. The fee shown
 * before that is a preview of the same 3% the server adds.
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
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session, isPending: sessionPending } = useSession();
  const router = useRouter();
  // The session is only known in the browser; the first client render must
  // match the server's (signed-out) markup or React discards the panel.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && Boolean(session?.user);
  const soldOut = event.remaining === 0;
  const closed = event.status === 'CANCELLED' || event.ended;

  // A paid event sells only its priced types: the orders API refuses a free
  // one in a paid order, and RSVP refuses the event altogether.
  const paidTiers = event.tiers.filter((t) => t.priceMinor > 0);
  const tierCap = (t: TicketTypeData) => Math.min(availableOf(t), MAX_PER_BOOKING, event.remaining ?? MAX_PER_BOOKING);
  const items = paidTiers.map((t) => ({ t, qty: picked[t.id] ?? 0 })).filter((x) => x.qty > 0);
  const count = items.reduce((n, x) => n + x.qty, 0);
  const subtotal = items.reduce((n, x) => n + x.qty * x.t.priceMinor, 0);
  const fee = previewFee(subtotal);
  const currency = paidTiers[0]?.currency ?? 'GBP';
  const anyLeft = paidTiers.some((t) => tierCap(t) > 0);

  async function checkout() {
    if (count === 0 || pending) return;
    if (!session?.user) {
      router.push(signInHref(`${event.href}#book`) as never);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const quote = await createOrder(
        event.id,
        items.map((x) => ({ ticketTypeId: x.t.id, quantity: x.qty })),
      );
      router.push(`/checkout/${quote.orderId}` as never);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t start your order. Please try again.');
      setPending(false);
    }
  }

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
        <h2 className="text-[22px] text-strong">{paid ? 'Tickets' : 'Reserve your place'}</h2>
        <span className="text-[13px] text-faint">{event.tiers[0]?.currency ?? 'GBP'}</span>
      </div>

      <ul className="mt-5 flex flex-col gap-3">
        {paid ? (
          paidTiers.map((t) => {
            const left = t.quantity - t.sold;
            const max = tierCap(t);
            const n = picked[t.id] ?? 0;
            return (
              <li
                key={t.id}
                className={`flex items-center gap-4 rounded-2xl border p-4 ${n > 0 ? 'border-line-3 bg-softer' : 'border-line'}`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[16px]">{t.name}</span>
                  {t.description && <span className="text-[13px] text-muted">{t.description}</span>}
                  <span className="text-[15px] text-accent">{money(t.priceMinor, t.currency)}</span>
                  {max <= 0 ? (
                    <span className="text-[12px] text-faint">Sold out</span>
                  ) : left <= 10 ? (
                    <span className="text-[12px] text-faint">Only {left} left</span>
                  ) : null}
                </div>
                <Stepper
                  value={n}
                  min={0}
                  max={max}
                  onChange={(v) => setPicked((p) => ({ ...p, [t.id]: v }))}
                  label={`${t.name} quantity`}
                  decLabel={`Remove one ${t.name}`}
                  incLabel={`Add one ${t.name}`}
                />
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
              {event.remaining !== null && event.remaining > 0 && event.remaining <= 10 && (
                <span className="text-[12px] text-faint">Only {event.remaining} left</span>
              )}
              {soldOut && <span className="text-[12px] text-faint">Sold out</span>}
            </div>
            <Stepper
              value={qty}
              min={0}
              max={cap}
              onChange={setQty}
              label={`${tierName} quantity`}
              decLabel={`Remove one ${tierName}`}
              incLabel={`Add one ${tierName}`}
            />
          </li>
        )}
      </ul>

      <div className="rule-x my-6" />

      {paid ? (
        <>
          <dl className="flex flex-col gap-2 text-[15px]" aria-live="polite">
            <div className="flex items-center justify-between">
              <dt className="text-ink-2">{count === 1 ? '1 ticket' : `${count} tickets`}</dt>
              <dd>{amount(subtotal, currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-2">Booking fee ({PLATFORM_FEE_BPS / 100}%)</dt>
              <dd>{amount(fee, currency)}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-ink-2">Total</dt>
              <dd className="text-[22px] text-strong">{amount(subtotal + fee, currency)}</dd>
            </div>
          </dl>
          {!anyLeft ? (
            <span className="btn btn-lg btn-muted mt-5 w-full">Sold out</span>
          ) : count === 0 ? (
            <span className="btn btn-lg btn-muted mt-5 w-full">Choose a ticket</span>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg mt-5 w-full"
              disabled={pending || sessionPending}
              onClick={() => void checkout()}
            >
              {pending ? 'Holding your tickets…' : `Continue · ${amount(subtotal + fee, currency)}`}
            </button>
          )}
          {error && (
            <p role="alert" className="error-text mt-3 text-center">
              {error}
            </p>
          )}
          <p className="mt-4 text-center text-[12px] text-faint">
            {signedIn ? 'Secure checkout with Stripe · one booking fee, no surprises' : 'Sign in to buy — it takes seconds.'}
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
            {signedIn ? 'Free to book · cancel any time from Your tickets' : 'Sign in to confirm — it takes seconds.'}
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
            {closed ? 'Details' : price === 'Free' ? 'Reserve a place' : 'Get tickets'}
          </a>
        </div>
      </div>
      {/* The bar is fixed over the page, so on phones the body gets 72px of
          room underneath — after the footer, which the layout renders. */}
      <style>{'@media (max-width: 760px) { body { padding-bottom: 72px; } }'}</style>
    </>
  );
}

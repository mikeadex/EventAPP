'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type Stripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icons';
import { EmptyState, Skeleton } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { amount } from '@/lib/format';
import {
  createPaymentIntent,
  formatCountdown,
  getOrder,
  secondsUntil,
  STRIPE_PUBLISHABLE_KEY,
  syncOrder,
  type OrderDetail,
} from '@/lib/payments';
import { useRequireSession } from '@/lib/use-api';
import { DateTile, OrderLines, whenLine } from './order-summary';

/**
 * Checkout (Checkout.dc.html): pay for an order the booking panel opened.
 *
 * Card details never touch this app. Stripe's Payment Element renders the
 * fields in its own iframe and `confirmPayment` sends them to Stripe
 * directly; all this page holds is the intent's client secret. The Payment
 * Element also shows Apple Pay / Google Pay where the browser has them, which
 * is what the design's express buttons are.
 *
 * TODO(confirm #4): the design's "Refundable up to 48 hours before" line is
 * unconfirmed, so the small print says what is known instead.
 * The design's promo code box has no API behind it and is left out.
 */
type Phase = 'loading' | 'ready' | 'expired' | 'unavailable';

let stripePromise: Promise<Stripe | null> | null = null;
function stripeFor(key: string) {
  // One Stripe instance per page load; loadStripe injects the script once.
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

export function CheckoutView({ orderId }: { orderId: string }) {
  const { user, ready } = useRequireSession();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState(STRIPE_PUBLISHABLE_KEY);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const o = await getOrder(orderId);
      setOrder(o);
      // Already paid — a webhook landing while this page opened, or a
      // refresh after paying. Never offer to charge for it again.
      if (o.status === 'PAID') {
        router.replace(`/checkout/${orderId}/confirmation` as never);
        return;
      }
      if (o.status !== 'PENDING' && o.status !== 'AWAITING_PAYMENT' || secondsUntil(o.expiresAt) === 0) {
        setPhase('expired');
        return;
      }
      const intent = await createPaymentIntent(orderId);
      setClientSecret(intent.clientSecret);
      if (!STRIPE_PUBLISHABLE_KEY && intent.publishableKey) setPublishableKey(intent.publishableKey);
      setPhase('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t load this order.');
      setPhase('unavailable');
    }
  }, [orderId, router]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // The hold countdown, re-read from `expiresAt` each tick so a tab that was
  // in the background doesn't come back believing it has more time than it does.
  useEffect(() => {
    if (!order || phase !== 'ready') return;
    const tick = () => {
      const s = secondsUntil(order.expiresAt);
      setLeft(s);
      if (s === 0) setPhase('expired');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order, phase]);

  const stripe = useMemo(() => (publishableKey ? stripeFor(publishableKey) : null), [publishableKey]);
  const theme = useTheme();
  const appearance = useMemo(() => appearanceFor(theme), [theme]);

  if (!ready || phase === 'loading') {
    return (
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_400px]" aria-busy="true">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (phase === 'unavailable' || !order) {
    return (
      <EmptyState
        icon="ticket"
        title="We couldn’t open this order"
        body={error ?? 'It may belong to another account.'}
        action={
          <Link href="/events" className="btn btn-primary">
            Discover events
          </Link>
        }
      />
    );
  }

  if (phase === 'expired') {
    return (
      <EmptyState
        icon="clock"
        title="Your tickets were released"
        body="Reservations are held for 15 minutes so they don’t sit unused. Nothing was charged — choose your tickets again to continue."
        action={
          <Link href="/events" className="btn btn-primary">
            Choose tickets again
          </Link>
        }
      />
    );
  }

  if (!publishableKey || !stripe) {
    return (
      <EmptyState
        icon="alert"
        title="Payments aren’t set up"
        body="This site has no Stripe publishable key, so card payment can’t load. Nothing has been charged."
      />
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="eyebrow text-accent">Checkout</span>
          <h1 className="h1 !text-[36px] sm:!text-[44px]">Pay for your tickets</h1>
        </div>
        <span className="inline-flex items-center gap-2 text-[14px] text-ink-2" aria-live="polite">
          <Icon name="lock" size={16} className="text-accent" />
          Secure · tickets held for <span className="font-mono">{formatCountdown(left)}</span>
        </span>
      </div>

      <div className="grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <section className="card p-6 sm:p-7" aria-labelledby="h-contact">
            <h2 id="h-contact" className="text-[20px] text-strong">
              Your details
            </h2>
            {/* The order already carries the name the booking was made in;
                tickets go to the signed-in account, so these aren't editable here. */}
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <dt className="text-[14px] text-ink-2">Name</dt>
                <dd className="text-[16px]">{user?.name || '—'}</dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-[14px] text-ink-2">Tickets go to</dt>
                <dd className="text-[16px] [overflow-wrap:anywhere]">{user?.email}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-6 sm:p-7" aria-labelledby="h-pay">
            <h2 id="h-pay" className="text-[20px] text-strong">
              Payment
            </h2>
            {clientSecret && (
              <Elements key={theme} stripe={stripe} options={{ clientSecret, appearance, loader: 'always' }}>
                <PaymentForm order={order} left={left} />
              </Elements>
            )}
          </section>
        </div>

        <aside aria-label="Order summary" className="panel flex flex-col p-6 md:sticky md:top-24">
          <div className="flex items-center gap-4">
            <DateTile iso={order.event.startsAt} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[18px] leading-snug text-strong">{order.event.title}</span>
              <span className="text-[13px] text-muted">{whenLine(order.event.startsAt)}</span>
            </span>
          </div>
          <div className="rule-x my-5" />
          <OrderLines order={order} />
          <div className="rule-x my-5" />
          <div className="flex items-baseline justify-between text-[15px]">
            <span className="text-ink-2">Total</span>
            <span className="text-[26px] text-strong">{amount(order.totalMinor, order.currency)}</span>
          </div>
          <p className="mt-4 text-center text-[12px] leading-relaxed text-faint">
            One booking fee, nothing else. Your tickets appear under Your tickets as soon as the payment is confirmed.
          </p>
        </aside>
      </div>
    </>
  );
}

/** Inside <Elements>: the Payment Element and the pay button. */
function PaymentForm({ order, left }: { order: OrderDetail; left: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | 'paying' | 'confirming'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const submitting = useRef(false);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting.current) return;
    submitting.current = true;
    setBusy('paying');
    setMessage(null);
    const confirmation = `${window.location.origin}/checkout/${order.id}/confirmation`;
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: confirmation },
      // Cards confirm in place; only methods that must leave the page
      // (bank redirects) go via return_url.
      redirect: 'if_required',
    });

    if (error) {
      submitting.current = false;
      if (error.type === 'card_error') {
        // The bank said no. The design's declined page: tickets still held,
        // nothing charged, try again.
        const q = new URLSearchParams({ declined: '1', ...(error.message ? { reason: error.message } : {}) });
        router.push(`/checkout/${order.id}/confirmation?${q}` as never);
        return;
      }
      // validation_error and the rest: something to fix in the form, or
      // a problem on our side. Say so here, next to the fields.
      setMessage(error.message ?? 'The payment could not be started. Nothing has been charged.');
      setBusy(null);
      return;
    }

    // Paid (or processing). The webhook is probably already issuing the
    // tickets, but it is neither instant nor guaranteed and the buyer is
    // watching, so ask the server to check now.
    setBusy('confirming');
    if (paymentIntent?.status === 'succeeded') {
      await syncOrder(order.id).catch(() => undefined);
    }
    router.replace(`/checkout/${order.id}/confirmation` as never);
  }

  return (
    <form onSubmit={pay} className="mt-5 flex flex-col gap-5">
      {!loaded && <Skeleton className="h-[220px]" />}
      <div className={loaded ? '' : 'h-0 overflow-hidden'}>
        <PaymentElement
          onReady={() => setLoaded(true)}
          options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }}
        />
      </div>
      {message && (
        <p role="alert" className="error-text">
          {message}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={!stripe || !loaded || busy !== null || left === 0}>
        {busy === 'confirming' ? (
          'Confirming…'
        ) : busy === 'paying' ? (
          'Paying…'
        ) : (
          <>
            <Icon name="lock" size={16} /> Pay {amount(order.totalMinor, order.currency)}
          </>
        )}
      </button>
    </form>
  );
}

/** The page's theme (`data-theme` on <html>), kept current as it's toggled. */
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

/**
 * Stripe's Appearance API wants concrete colours, not `var()`, so the tokens
 * are read off the document for the current theme. Nothing here is a value
 * of its own: change globals.css and this follows.
 */
function appearanceFor(theme: 'dark' | 'light'): Appearance {
  if (typeof document === 'undefined') return { theme: theme === 'light' ? 'stripe' : 'night' };
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const rgb = token('--accent-rgb');
  return {
    theme: theme === 'light' ? 'stripe' : 'night',
    labels: 'above',
    variables: {
      fontFamily: 'Alata, ui-sans-serif, system-ui, sans-serif',
      fontSizeBase: '15px',
      borderRadius: '14px',
      colorPrimary: token('--accent'),
      colorBackground: token('--raised'),
      colorText: token('--ink'),
      colorTextSecondary: token('--ink-2'),
      colorTextPlaceholder: token('--faint'),
      colorDanger: token('--accent'),
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: `1px solid rgba(${rgb}, 0.28)`, boxShadow: 'none', padding: '14px 18px' },
      '.Input:focus': { border: `1px solid rgba(${rgb}, 0.5)`, boxShadow: 'none', outline: 'none' },
      '.Tab': { border: `1px solid rgba(${rgb}, 0.16)`, backgroundColor: token('--surface'), boxShadow: 'none' },
      '.Tab--selected': { border: `1px solid rgba(${rgb}, 0.5)`, backgroundColor: `rgba(${rgb}, 0.12)`, boxShadow: 'none' },
      '.Tab:hover': { color: token('--accent') },
      '.Label': { fontSize: '14px', color: token('--ink') },
    },
  };
}

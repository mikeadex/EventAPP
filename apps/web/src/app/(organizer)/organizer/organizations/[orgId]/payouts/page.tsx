'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { amount, fmtDateShort } from '@/lib/format';
import { PLATFORM_FEE_BPS } from '@/lib/payments';
import type { ConnectPayouts, ConnectStatus, PayoutStatus } from '@/lib/types';
import { useApi, useMe } from '@/lib/use-api';

/**
 * Payouts — where a host is with Stripe Connect.
 *
 * The design (Payouts.dc.html) shows a host already taking money: a next
 * payout, a period breakdown, a bank card ending. The next payout and the
 * past payouts come from the host's own Stripe account via the API; the
 * period breakdown and bank card ending don't (TODO(confirm #3): no sales
 * ledger of our own, and Stripe keeps the bank details), so the page leads
 * with where the host is and shows the figures once there are any.
 */
const HEADLINE: Record<PayoutStatus, string> = {
  NOT_STARTED: 'Set up payouts',
  ONBOARDING: 'Finish setting up payouts',
  RESTRICTED: 'Stripe needs to review your account',
  DISABLED: 'Payouts are turned off',
  ENABLED: 'You’re set up for payouts',
};

const BLURB: Record<PayoutStatus, string> = {
  NOT_STARTED:
    'Stripe handles the money and pays you directly. Until this is done you can run free events, but you can’t sell tickets.',
  ONBOARDING:
    'Stripe still needs a few details. Until they have them you can run free events, but you can’t sell tickets.',
  RESTRICTED: 'Stripe is reviewing your account and has paused payouts. They’ll contact you if they need anything.',
  DISABLED: 'Payouts are off for this account. Contact us and we’ll look into it.',
  ENABLED: 'Ticket money goes to your Stripe account. Ekklesia keeps only the booking fee attendees pay on top.',
};

export default function PayoutsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const me = useMe();
  const membership = me.data?.memberships.find((m) => m.organizationId === orgId);
  const canManage = me.data?.permissionsByOrg[orgId]?.includes('payout:manage') ?? false;
  const status = useApi<ConnectStatus>(`/v1/organizations/${orgId}/connect/status`);
  const payouts = useApi<ConnectPayouts>(
    status.data?.status === 'ENABLED' ? `/v1/organizations/${orgId}/connect/payouts` : null,
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onboarding happens on Stripe's pages and comes back here, but a host who
  // finished in another tab should see it without a reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void status.reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [status]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const { url } = await apiClient<{ url: string }>(`/v1/organizations/${orgId}/connect/onboard`, {
        method: 'POST',
        body: {},
      });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t start payout setup. Try again.');
      setStarting(false);
    }
  }

  const s = status.data;
  const live = s?.status === 'ENABLED';
  const inProgress = s?.status === 'NOT_STARTED' || s?.status === 'ONBOARDING';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="eyebrow text-accent [overflow-wrap:anywhere]">{membership?.name ?? 'Your organisation'}</span>
        <h1 className="text-[34px] leading-[1.1] text-strong sm:text-[40px]">Payouts</h1>
      </div>

      {status.status === 'error' ? (
        <ErrorCard
          message={status.error}
          action={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void status.reload()}>
              Try again
            </button>
          }
        />
      ) : !s ? (
        <Skeleton className="h-56 rounded-panel" />
      ) : (
        <section
          className={`relative flex flex-col gap-3 overflow-hidden rounded-panel border bg-surface p-7 shadow-panel ${
            live ? 'border-line-3' : 'border-line-2'
          }`}
          aria-live="polite"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-[280px] w-[280px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.22), transparent 65%)' }}
          />
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-soft text-accent">
            <Icon name={live ? 'check' : 'bank'} size={22} />
          </span>
          <h2 className="relative text-[28px] leading-tight text-strong">{HEADLINE[s.status]}</h2>
          <p className="relative max-w-[560px] text-[15px] leading-relaxed text-body">{BLURB[s.status]}</p>
          {s.requirementsDue.length > 0 && !live && (
            <p className="relative text-[13px] text-muted">
              Stripe is waiting for: {s.requirementsDue.map((r) => r.replace(/[._]/g, ' ')).join(', ')}.
            </p>
          )}
          {inProgress &&
            (canManage ? (
              <div className="relative mt-2 flex flex-col gap-3">
                <button type="button" className="btn btn-primary btn-lg self-start" disabled={starting} onClick={() => void start()}>
                  {starting ? 'Opening Stripe…' : s.status === 'NOT_STARTED' ? 'Set up payouts with Stripe' : 'Continue with Stripe'}
                </button>
                {error && (
                  <p role="alert" className="error-text">
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <p className="relative text-[14px] text-muted">Only an owner or admin can set this up.</p>
            ))}
          {live && (
            <p className="relative mt-1 inline-flex items-center gap-2 text-[13px] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Statements and bank details are in your Stripe dashboard.
            </p>
          )}
        </section>
      )}

      {live && <PayoutFigures data={payouts} />}

      <p className="text-[13px] text-faint">
        Attendees pay one booking fee of {PLATFORM_FEE_BPS / 100}% on top of the ticket price; you receive the ticket
        price. Bank details are held by Stripe, not by Ekklesia.
      </p>
    </div>
  );
}

const PAYOUT_STATUS: Record<ConnectPayouts['items'][number]['status'], string> = {
  paid: 'Paid',
  pending: 'Pending',
  in_transit: 'On its way',
  canceled: 'Cancelled',
  failed: 'Failed',
};

function scheduleLine(s: NonNullable<ConnectPayouts['schedule']>) {
  const day = s.weeklyAnchor ? s.weeklyAnchor[0]!.toUpperCase() + s.weeklyAnchor.slice(1) + 's' : null;
  switch (s.interval) {
    case 'daily':
      return `Paid out daily, ${s.delayDays} days after each sale`;
    case 'weekly':
      return `Paid out weekly${day ? `, on ${day}` : ''}`;
    case 'monthly':
      return `Paid out monthly${s.monthlyAnchor ? `, on the ${s.monthlyAnchor}${ordinal(s.monthlyAnchor)}` : ''}`;
    default:
      return 'Paid out when you request it in Stripe';
  }
}

function ordinal(n: number) {
  const r = n % 100;
  if (r >= 11 && r <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/** Next payout (Stripe's available balance) and the past payouts table. */
function PayoutFigures({ data }: { data: ReturnType<typeof useApi<ConnectPayouts>> }) {
  if (data.status === 'error') {
    return (
      <ErrorCard
        message={data.error}
        action={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void data.reload()}>
            Try again
          </button>
        }
      />
    );
  }
  if (!data.data) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-40 rounded-panel" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    );
  }
  const { balance, schedule, items } = data.data;
  const next = balance?.available;
  const pending = balance?.pending;
  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section
          className="relative flex flex-col gap-2.5 overflow-hidden rounded-panel border border-line-3 bg-surface p-7 shadow-panel"
          aria-labelledby="h-next"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-[280px] w-[280px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.22), transparent 65%)' }}
          />
          <h2 id="h-next" className="eyebrow relative text-[10px] text-faint">
            Next payout
          </h2>
          <span className="relative text-[48px] leading-[1.05] text-strong">
            {next ? amount(next.amountMinor, next.currency) : amount(0)}
          </span>
          <span className="relative text-[15px] text-ink-2">
            {next && next.amountMinor > 0 ? 'Ready to pay out from your Stripe balance' : 'Nothing waiting to be paid out'}
          </span>
          {schedule && (
            <span className="relative mt-2 inline-flex items-center gap-2 text-[13px] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              {scheduleLine(schedule)}
            </span>
          )}
        </section>
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="h-balance">
          <h2 id="h-balance" className="eyebrow text-[10px] text-faint">
            Your Stripe balance
          </h2>
          <div className="flex justify-between gap-4 text-[15px]">
            <span className="text-ink-2">Available</span>
            <span>{next ? amount(next.amountMinor, next.currency) : amount(0)}</span>
          </div>
          <div className="flex justify-between gap-4 text-[15px]">
            <span className="text-ink-2">Still settling</span>
            <span>{pending ? amount(pending.amountMinor, pending.currency) : amount(0)}</span>
          </div>
          <div className="rule-x my-1" />
          <p className="text-[13px] leading-relaxed text-muted">
            Ticket money reaches your balance after each sale, less the booking fee, and settles over a few days before
            Stripe pays it out.
          </p>
        </section>
      </div>

      <section className="card overflow-hidden" aria-labelledby="h-past">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 id="h-past" className="text-[20px] text-strong">
            Past payouts
          </h2>
        </div>
        {items.length === 0 ? (
          <p className="border-t border-line px-6 py-10 text-center text-[15px] text-body">
            No payouts yet. The first one goes out once a sale has settled.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-y border-line">
                  {['Date', 'Status', 'Method', 'Amount'].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-3 text-[11px] font-normal uppercase tracking-[0.2em] text-faint first:pl-6 last:pr-6 ${i === 3 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-b-0">
                    <td className="py-4 pl-6 pr-4 align-middle">{fmtDateShort(p.arrivalDate)}</td>
                    <td className="p-4 align-middle">
                      <span className={p.status === 'paid' ? 'tag' : 'tag-muted'} title={p.failureMessage ?? undefined}>
                        {PAYOUT_STATUS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-ink-2">{p.method === 'instant' ? 'Instant' : 'Bank transfer'}</td>
                    <td className="py-4 pl-4 pr-6 text-right align-middle font-mono text-strong">
                      {amount(p.amountMinor, p.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

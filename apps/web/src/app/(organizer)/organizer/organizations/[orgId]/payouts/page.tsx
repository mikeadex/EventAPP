'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { PLATFORM_FEE_BPS } from '@/lib/payments';
import type { ConnectStatus, PayoutStatus } from '@/lib/types';
import { useApi, useMe } from '@/lib/use-api';

/**
 * Payouts — where a host is with Stripe Connect.
 *
 * The design (Payouts.dc.html) shows a host already taking money: a next
 * payout, a period breakdown, a bank card ending. TODO(confirm #3): none of
 * those figures exist in the API; Stripe holds them. What does exist is the
 * account's status and the onboarding link, and most hosts opening this page
 * have no account at all, so it leads with that.
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
              Payouts and statements are in your Stripe dashboard.
            </p>
          )}
        </section>
      )}

      <p className="text-[13px] text-faint">
        Attendees pay one booking fee of {PLATFORM_FEE_BPS / 100}% on top of the ticket price; you receive the ticket
        price. Bank details are held by Stripe, not by Ekklesia.
      </p>
    </div>
  );
}

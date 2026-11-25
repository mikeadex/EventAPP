'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/icons';
import { EmptyState, ErrorCard, Skeleton } from '@/components/ui';
import { fmtDay, fmtTime, plural } from '@/lib/format';
import type { Organization, OrgEvent } from '@/lib/types';
import { useApi, useMe } from '@/lib/use-api';

/**
 * What a host is told about verification, per state.
 *
 * Nothing in the API reads `verificationStatus` before publishing, so telling
 * an unverified host that publishing is "gated" is untrue — and it was the
 * sentence sitting next to "Create an event" on the page every new host lands
 * on. Say what they can actually do. REJECTED and SUSPENDED are spelled out
 * separately: "publishing is open" is not a thing to tell a suspended host.
 */
const VERIFICATION_COPY: Record<string, string> = {
  UNVERIFIED: 'Publishing is open — you can create and publish events now, verified or not.',
  PENDING: 'Your details are with us for review. Publishing stays open in the meantime.',
  VERIFIED: 'Verified.',
  REJECTED: 'We could not verify these details. Get in touch and we will help.',
  SUSPENDED: 'This organisation is suspended. Get in touch and we will help.',
};

const STATUS_LABEL: Record<OrgEvent['status'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Live',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Ended',
};

type Filter = 'upcoming' | 'drafts' | 'past';

export default function OrganizationDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const welcome = useSearchParams().get('welcome') === '1';
  const me = useMe();
  const membership = me.data?.memberships.find((m) => m.organizationId === orgId);
  const org = useApi<Organization>(membership ? `/v1/organizations/${membership.slug}` : null);
  const events = useApi<OrgEvent[]>(membership ? `/v1/organizations/${orgId}/events` : null);
  const [filter, setFilter] = useState<Filter>('upcoming');

  if (me.status === 'ready' && !membership) {
    return (
      <EmptyState
        icon="building"
        title="You don’t host here"
        body="This organisation isn’t on your account."
        action={
          <Link href="/organizer" className="btn btn-primary">
            Your organisations
          </Link>
        }
      />
    );
  }
  if (me.status === 'error' || org.status === 'error')
    return (
      <ErrorCard
        message={(me.error ?? org.error)!}
        action={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => (me.status === 'error' ? me.reload() : org.reload())}>
            Try again
          </button>
        }
      />
    );
  if (!org.data) return <Skeleton className="h-80 rounded-card" />;

  const o = org.data;
  const now = Date.now();
  const all = events.data ?? [];
  const isPast = (e: OrgEvent) => new Date(e.endsAt).getTime() < now || e.status === 'CANCELLED' || e.status === 'COMPLETED';
  const upcoming = all.filter((e) => !isPast(e) && e.status === 'PUBLISHED');
  const drafts = all.filter((e) => !isPast(e) && (e.status === 'DRAFT' || e.status === 'SCHEDULED'));
  const past = all.filter(isPast).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const going = upcoming.reduce((n, e) => n + e.attendeeCount, 0);
  const shown = filter === 'upcoming' ? upcoming : filter === 'drafts' ? drafts : past;
  const newEvent = `/organizer/organizations/${orgId}/events/new`;

  return (
    <div className="flex flex-col gap-7">
      {welcome && (
        <div role="status" className="panel flex items-start gap-4 p-5">
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
            <Icon name="check" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[17px] text-strong">You’re set up — welcome to Ekklesia.</span>
            <span className="text-[14px] text-body">Create your first event and share its link. It takes a few minutes.</span>
          </div>
        </div>
      )}

      {/* TODO(confirm): the design has 30 days / 90 days / Year range chips;
          nothing in the API reports figures by date range. */}
      <div className="flex flex-col gap-3">
        <span className="eyebrow text-accent [overflow-wrap:anywhere]">{o.name}</span>
        <h1 className="text-[34px] leading-[1.1] text-strong sm:text-[40px]">Overview</h1>
      </div>

      {/* TODO(confirm #3): the design's KPIs are Gross sales, Tickets, Avg.
          order and Check-in rate, with a sales chart and a next-payout card.
          There are no sales, payout or org-wide check-in figures in the API,
          so these are the figures it does have. */}
      <dl className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi label="Going" value={events.data ? going : '—'} sub="Across live events" />
        <Kpi label="Live events" value={events.data ? upcoming.length : '—'} sub="On sale now" />
        <Kpi label="Drafts" value={events.data ? drafts.length : '—'} sub="Not yet published" />
        <div className="card flex flex-col gap-2 p-5">
          <dt className="eyebrow text-[10px] text-faint">Verification</dt>
          <dd className="text-[13px] leading-relaxed text-body">
            {VERIFICATION_COPY[o.verificationStatus] ?? VERIFICATION_COPY.UNVERIFIED}
          </dd>
        </div>
      </dl>

      <section className="card overflow-hidden" aria-labelledby="events-h">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <h2 id="events-h" className="text-[20px] text-strong">
            Your events
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Show events" className="flex flex-wrap gap-2">
              {(
                [
                  ['upcoming', `Live · ${upcoming.length}`],
                  ['drafts', `Drafts · ${drafts.length}`],
                  ['past', `Past · ${past.length}`],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" aria-pressed={filter === v} className="chip" onClick={() => setFilter(v)}>
                  {label}
                </button>
              ))}
            </div>
            <Link href={newEvent as never} className="btn btn-outline btn-sm">
              <Icon name="plus" size={15} /> New event
            </Link>
          </div>
        </div>

        {events.status === 'loading' ? (
          <div className="flex flex-col gap-3 px-6 pb-6" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : events.status === 'error' ? (
          <div className="px-6 pb-6">
            <ErrorCard
              message={events.error}
              action={
                <button type="button" className="btn btn-outline btn-sm" onClick={() => events.reload()}>
                  Try again
                </button>
              }
            />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border-t border-line px-6 py-14 text-center">
            <Icon name="calendar" size={40} className="text-faint" />
            <h3 className="text-[20px] text-strong">
              {filter === 'upcoming' ? 'Nothing live yet' : filter === 'drafts' ? 'No drafts' : 'No past events'}
            </h3>
            {filter !== 'past' && (
              <>
                <p className="max-w-[360px] text-[15px] text-body">Create an event, then publish it when you’re ready.</p>
                <Link href={newEvent as never} className="btn btn-primary">
                  Create your first event
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            {/* TODO(confirm #3): the design has a Sales column; there are no
                sales figures in the API. */}
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-y border-line">
                  {['Event', 'Status', 'Going', ''].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={`px-4 py-3 text-[11px] font-normal uppercase tracking-[0.2em] text-faint first:pl-6 last:pr-6 ${i === 3 ? 'text-right' : ''}`}
                    >
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <EventRow key={e.id} e={e} orgId={orgId} orgSlug={o.slug} past={filter === 'past'} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="card flex flex-col gap-2 p-5">
      <dt className="eyebrow text-[10px] text-faint">{label}</dt>
      <dd className="flex flex-col gap-2">
        <span className="text-[30px] leading-none text-strong">{value}</span>
        <span className="text-[13px] text-muted">{sub}</span>
      </dd>
    </div>
  );
}

function EventRow({ e, orgId, orgSlug, past }: { e: OrgEvent; orgId: string; orgSlug: string; past: boolean }) {
  const base = `/organizer/organizations/${orgId}/events/${e.id}`;
  const pct = e.capacity ? Math.min(100, Math.round((e.attendeeCount / e.capacity) * 100)) : null;
  const live = e.status === 'PUBLISHED' && !past;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="py-4 pl-6 pr-4 align-middle">
        <span className="flex flex-col gap-1">
          <Link href={`${base}/edit` as never} className="text-strong [overflow-wrap:anywhere] hover:text-accent">
            {e.title}
          </Link>
          <span className="text-[13px] text-muted">
            {fmtDay(e.startsAt)} · {fmtTime(e.startsAt)}
            {e.seriesId && <span className="text-faint"> · Part of a series</span>}
          </span>
        </span>
      </td>
      <td className="p-4 align-middle">
        <span className={live ? 'tag' : 'tag-muted'}>{STATUS_LABEL[e.status]}</span>
      </td>
      <td className="p-4 align-middle">
        <span className="flex min-w-[120px] flex-col gap-1.5">
          <span className="text-[14px] text-ink-2">
            {e.capacity ? `${e.attendeeCount} / ${e.capacity}` : plural(e.attendeeCount, 'person', 'people') + ' going'}
          </span>
          {pct !== null && (
            <span className="h-1 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
      </td>
      <td className="whitespace-nowrap py-4 pl-4 pr-6 text-right align-middle text-[14px]">
        <Link href={`${base}/attendees` as never} className="text-accent hover:underline">
          Attendees
        </Link>
        {live && (
          <>
            <span className="mx-2 text-faint" aria-hidden="true">·</span>
            <Link href={`${base}/check-in` as never} className="text-accent hover:underline">
              Check-in
            </Link>
          </>
        )}
        <span className="mx-2 text-faint" aria-hidden="true">·</span>
        <Link href={`${base}/edit` as never} className="text-ink-2 hover:text-ink">
          Edit
        </Link>
        {e.status === 'PUBLISHED' && (
          <>
            <span className="mx-2 text-faint" aria-hidden="true">·</span>
            <Link href={`/${orgSlug}/${e.slug}` as never} className="text-ink-2 hover:text-ink">
              View
            </Link>
          </>
        )}
      </td>
    </tr>
  );
}

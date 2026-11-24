'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Cover } from '@/components/cover';
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
  if (me.status === 'error' || org.status === 'error') return <ErrorCard message={(me.error ?? org.error)!} />;
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
    <div className="flex flex-col gap-8">
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-accent">Dashboard</span>
          <h1 className="h1 !text-[44px]">{o.name}</h1>
          <Link href={`/${o.slug}` as never} className="text-[14px] text-muted hover:text-accent">
            Your public page: /{o.slug} <Icon name="external" size={13} className="inline" />
          </Link>
        </div>
        <Link href={newEvent as never} className="btn btn-primary btn-lg">
          <Icon name="plus" size={18} /> New event
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Live events" value={events.data ? upcoming.length : '—'} />
        <Kpi label="Going (upcoming)" value={events.data ? going : '—'} />
        <Kpi label="Drafts" value={events.data ? drafts.length : '—'} />
        <div className="card flex flex-col gap-2 p-5">
          <dt className="eyebrow text-[10px] text-faint">Verification</dt>
          <dd className="text-[13px] leading-relaxed text-body">
            {VERIFICATION_COPY[o.verificationStatus] ?? VERIFICATION_COPY.UNVERIFIED}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-5" aria-labelledby="events-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="events-h" className="text-[24px] text-strong">
            Events
          </h2>
          <div role="tablist" aria-label="Filter events" className="flex gap-2">
            {(
              [
                ['upcoming', `Live · ${upcoming.length}`],
                ['drafts', `Drafts · ${drafts.length}`],
                ['past', `Past · ${past.length}`],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={filter === v} className="chip" onClick={() => setFilter(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {events.status === 'loading' ? (
          <Skeleton className="h-48 rounded-card" />
        ) : events.status === 'error' ? (
          <ErrorCard message={events.error} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={filter === 'upcoming' ? 'Nothing live yet' : filter === 'drafts' ? 'No drafts' : 'No past events'}
            body={filter === 'past' ? undefined : 'Create an event, then publish it when you’re ready.'}
            action={
              filter === 'past' ? undefined : (
                <Link href={newEvent as never} className="btn btn-primary">
                  Create an event
                </Link>
              )
            }
          />
        ) : (
          <ul className="card divide-y divide-line">
            {shown.map((e) => (
              <EventRow key={e.id} e={e} orgId={orgId} orgSlug={o.slug} past={filter === 'past'} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card flex flex-col gap-2 p-5">
      <dt className="eyebrow text-[10px] text-faint">{label}</dt>
      <dd className="text-[34px] leading-none text-strong">{value}</dd>
    </div>
  );
}

function EventRow({ e, orgId, orgSlug, past }: { e: OrgEvent; orgId: string; orgSlug: string; past: boolean }) {
  const base = `/organizer/organizations/${orgId}/events/${e.id}`;
  const pct = e.capacity ? Math.min(100, Math.round((e.attendeeCount / e.capacity) * 100)) : null;
  return (
    <li className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative h-14 w-20 flex-none overflow-hidden rounded-xl bg-surface-2">
          <Cover image={e.coverImageUrl} category="OTHER" title={e.title} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <Link href={`${base}/edit` as never} className="truncate text-[17px] text-strong hover:text-accent">
              {e.title}
            </Link>
            <span className={e.status === 'PUBLISHED' && !past ? 'tag' : 'tag-muted'}>{STATUS_LABEL[e.status]}</span>
          </span>
          <span className="text-[13px] text-muted">
            {fmtDay(e.startsAt)} · {fmtTime(e.startsAt)}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-none flex-col gap-1.5 sm:max-w-[240px] xl:w-[150px]">
        <span className="text-[13px] text-ink-2">
          {e.capacity ? `${e.attendeeCount} / ${e.capacity} going` : plural(e.attendeeCount, 'person', 'people') + ' going'}
        </span>
        {pct !== null && (
          <span className="h-1 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>
      <div className="flex flex-none flex-wrap gap-2">
        <Link href={`${base}/attendees` as never} className="btn btn-outline btn-sm">
          <Icon name="users" size={15} /> Attendees
        </Link>
        {e.status === 'PUBLISHED' && !past && (
          <Link href={`${base}/check-in` as never} className="btn btn-outline btn-sm">
            <Icon name="scan" size={15} /> Check-in
          </Link>
        )}
        {e.status === 'PUBLISHED' && (
          <Link href={`/${orgSlug}/${e.slug}` as never} target="_blank" className="icon-btn" aria-label={`View ${e.title}`}>
            <Icon name="external" size={16} />
          </Link>
        )}
      </div>
    </li>
  );
}

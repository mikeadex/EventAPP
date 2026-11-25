'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { Avatar, Skeleton } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/host';
import type { Organization } from '@/lib/types';
import { useActiveInView } from '@/lib/use-active-in-view';
import { useApi, useMe, useRequireSession } from '@/lib/use-api';

const KIND_LABEL: Record<Organization['kind'], string> = {
  CHURCH: 'Church',
  MINISTRY: 'Ministry',
  COMMUNITY: 'Community',
};

/** The design's `.hn` item: plain text and icon, soft fill when current. */
export const HN_ITEM =
  'flex flex-none items-center gap-3 whitespace-nowrap rounded-[14px] px-3.5 py-[11px] text-[15px] text-ink-2 transition-colors hover:text-ink aria-[current=page]:bg-soft aria-[current=page]:text-accent-ink sm:w-full';

/**
 * The host area's frame (HostNav): a sidebar with the host's identity, a
 * "New event" button and the nav, which becomes a horizontal row on phones.
 * Pages with no organisation in the URL (the picker, "Become a host") get no
 * sidebar at all.
 *
 * TODO(confirm): the design's nav also has "Host settings"; there's no web
 * settings page yet. Payouts is shown to members who can see payout status.
 */
export function HostShell({ children }: { children: ReactNode }) {
  const { ready } = useRequireSession();
  const me = useMe(ready);
  const params = useParams<{ orgId?: string; eventId?: string }>();
  const pathname = usePathname();
  // The nav only mounts once the session has loaded, so that's part of the key.
  const navRef = useActiveInView<HTMLElement>(`${pathname}|${me.data ? 1 : 0}`);
  const membership = params.orgId ? me.data?.memberships.find((m) => m.organizationId === params.orgId) : undefined;
  const org = useApi<Organization>(membership ? `/v1/organizations/${membership.slug}` : null);

  if (!ready) {
    return (
      <div className="wrap pt-10" aria-busy="true">
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  if (!params.orgId) return <div className="wrap pt-10">{children}</div>;

  const base = `/organizer/organizations/${params.orgId}`;
  const eventBase = params.eventId ? `${base}/events/${params.eventId}` : null;
  const items: { href: string; label: string; icon: IconName; active: boolean }[] = [
    { href: base, label: 'Overview', icon: 'grid', active: pathname === base },
    {
      href: base,
      label: 'Events',
      icon: 'calendar',
      active: pathname.startsWith(`${base}/events/new`) || (!!eventBase && pathname.startsWith(`${eventBase}/edit`)),
    },
    ...(params.orgId && me.data?.permissionsByOrg[params.orgId]?.includes('payout:view')
      ? [{ href: `${base}/payouts`, label: 'Payouts', icon: 'bank' as const, active: pathname.startsWith(`${base}/payouts`) }]
      : []),
    // Attendees and the scanner belong to one event: there's no list or
    // scanner across all of a host's events.
    ...(eventBase
      ? [
          { href: `${eventBase}/attendees`, label: 'Attendees', icon: 'users' as const, active: pathname.startsWith(`${eventBase}/attendees`) },
          { href: `${eventBase}/check-in`, label: 'Check-in', icon: 'scan' as const, active: pathname.startsWith(`${eventBase}/check-in`) },
        ]
      : []),
  ];

  return (
    <div className="wrap grid grid-cols-[minmax(0,1fr)] items-start gap-6 pt-10 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col">
        {membership && (
          <div className="mb-2 hidden items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 sm:flex">
            <Avatar name={membership.name} size={40} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] text-strong">{membership.name}</span>
              <span className="truncate text-[12px] text-muted">
                {org.data ? `${KIND_LABEL[org.data.kind]} · ` : ''}
                {ROLE_LABEL[membership.role] ?? membership.role}
              </span>
            </div>
          </div>
        )}
        <nav
          ref={navRef}
          aria-label="Host dashboard"
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-col sm:gap-1 sm:overflow-visible sm:p-0"
        >
          <Link
            href={`${base}/events/new` as never}
            className="btn btn-primary flex-none sm:mb-3 sm:w-full"
          >
            <Icon name="plus" size={16} /> New event
          </Link>
          {items.map((i) => (
            <Link
              key={i.label}
              href={i.href as never}
              aria-current={i.active ? 'page' : undefined}
              className={HN_ITEM}
            >
              <Icon name={i.icon} size={18} /> {i.label}
            </Link>
          ))}
        </nav>
        {membership && (
          <div className="hidden flex-col sm:flex">
            <div className="rule-x my-3" />
            <Link href={`/${membership.slug}` as never} className={HN_ITEM}>
              <Icon name="external" size={18} /> View host page
            </Link>
            <Link href="/organizer" className="px-3.5 pt-2 text-[13px] text-muted hover:text-accent">
              Switch organisation
            </Link>
          </div>
        )}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { Skeleton } from '@/components/ui';
import { useMe, useRequireSession } from '@/lib/use-api';

/**
 * The host area's frame: a sidebar on desktop that becomes a horizontal tab
 * strip on phones. Every item links to a page that exists — the old nav
 * pointed at five routes (events, attendees, payouts, staff, settings) that
 * all 404'd.
 */
export function HostShell({ children }: { children: ReactNode }) {
  const { ready } = useRequireSession();
  const me = useMe(ready);
  const params = useParams<{ orgId?: string; eventId?: string }>();
  const pathname = usePathname();
  const org = params.orgId ? me.data?.memberships.find((m) => m.organizationId === params.orgId) : undefined;

  const base = params.orgId ? `/organizer/organizations/${params.orgId}` : null;
  const items: { href: string; label: string; icon: IconName; exact?: boolean; external?: boolean }[] = base
    ? [
        { href: base, label: 'Overview', icon: 'grid', exact: true },
        { href: `${base}/events/new`, label: 'New event', icon: 'plus' },
        ...(params.eventId
          ? ([
              { href: `${base}/events/${params.eventId}/edit`, label: 'Edit event', icon: 'edit' },
              { href: `${base}/events/${params.eventId}/attendees`, label: 'Attendees', icon: 'users' },
              { href: `${base}/events/${params.eventId}/check-in`, label: 'Check-in', icon: 'scan' },
            ] as const)
          : []),
        ...(org ? [{ href: `/${org.slug}`, label: 'View host page', icon: 'external' as const, external: true }] : []),
      ]
    : [{ href: '/organizer', label: 'Your organisations', icon: 'building', exact: true }];

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  if (!ready) {
    return (
      <div className="wrap py-10" aria-busy="true">
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="wrap grid items-start gap-8 py-8 md:grid-cols-[220px_minmax(0,1fr)] md:py-10">
      <aside className="flex flex-col gap-4 md:sticky md:top-24">
        {org && (
          <div className="hidden flex-col gap-1 md:flex">
            <span className="eyebrow text-[10px] text-faint">Hosting</span>
            <Link href={base as never} className="truncate text-[17px] text-strong hover:text-accent">
              {org.name}
            </Link>
          </div>
        )}
        <nav aria-label="Host" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-col md:overflow-visible">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href as never}
              target={i.external ? '_blank' : undefined}
              aria-current={isActive(i.href, i.exact) ? 'page' : undefined}
              className="chip flex-none gap-2 md:justify-start"
            >
              <Icon name={i.icon} size={16} /> {i.label}
            </Link>
          ))}
        </nav>
        {base && (
          <Link href="/organizer" className="hidden text-[13px] text-muted hover:text-accent md:block">
            Switch organisation
          </Link>
        )}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Avatar, EmptyState, ErrorCard, PageIntro, Skeleton } from '@/components/ui';
import { Icon } from '@/components/icons';
import { hostMemberships, ROLE_LABEL } from '@/lib/host';
import { useMe } from '@/lib/use-api';

/** Hosts with one organisation go straight to it; others pick. */
export default function OrganizerHomePage() {
  const me = useMe();
  const router = useRouter();
  const orgs = me.data ? hostMemberships(me.data) : [];
  const only = orgs.length === 1 ? orgs[0] : undefined;

  useEffect(() => {
    if (only) router.replace(`/organizer/organizations/${only.organizationId}` as never);
  }, [only, router]);

  if (me.status === 'loading' || only) return <Skeleton className="h-64 rounded-card" />;
  if (me.status === 'error') return <ErrorCard message={me.error} />;

  if (orgs.length === 0) {
    return (
      <EmptyState
        icon="building"
        title="Host your first event"
        body="Set up your church or ministry in a couple of minutes. Publishing is open straight away."
        action={
          <Link href="/organizer/organizations/new" className="btn btn-primary">
            Become a host
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageIntro eyebrow="Host dashboard" title="Your organisations" />
      <div className="grid gap-4 sm:grid-cols-2">
        {orgs.map((m) => (
          <Link
            key={m.organizationId}
            href={`/organizer/organizations/${m.organizationId}` as never}
            className="card card-link flex items-center gap-4 p-5"
          >
            <Avatar name={m.name} size={48} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[18px] text-strong">{m.name}</span>
              <span className="text-[13px] text-muted">
                {ROLE_LABEL[m.role] ?? m.role} · /{m.slug}
              </span>
            </span>
          </Link>
        ))}
        <Link
          href="/organizer/organizations/new"
          className="card card-link flex items-center gap-4 border-dashed p-5 text-ink-2"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-2 text-accent">
            <Icon name="plus" />
          </span>
          Set up another organisation
        </Link>
      </div>
    </>
  );
}

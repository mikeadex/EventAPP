import { notFound } from 'next/navigation';
import { api, searchEvents } from '@/lib/api';
import type { Organization } from '@/lib/types';
import { Cover } from '@/components/cover';
import { EventCard } from '@/components/event-card';
import { Icon } from '@/components/icons';
import { Avatar, EmptyState } from '@/components/ui';
import { safeHttpUrl } from '@/lib/url';

export const revalidate = 300;

type Params = Promise<{ orgSlug: string }>;

const load = (slug: string) => api<Organization>(`/v1/organizations/${slug}`, { revalidate: 300 }).catch(() => null);

export async function generateMetadata({ params }: { params: Params }) {
  const { orgSlug } = await params;
  const org = await load(orgSlug);
  if (!org) return { title: 'Not found' };
  return { title: org.name, description: org.shortDescription ?? undefined };
}

const KIND: Record<string, string> = { CHURCH: 'Church', MINISTRY: 'Ministry', COMMUNITY: 'Community' };

export default async function HostPage({ params }: { params: Params }) {
  const { orgSlug } = await params;
  const org = await load(orgSlug);
  if (!org) notFound();

  // The public search has no host filter, so take the next 50 upcoming events
  // and keep this host's. Enough for any host page today.
  const upcoming = await searchEvents({ limit: 50 }).catch(() => null);
  const events = upcoming?.items.filter((e) => e.organization.slug === orgSlug) ?? [];

  return (
    <>
      <section className="relative -mt-[72px] overflow-hidden">
        <Cover image={org.coverImageUrl} category="worship" title={org.name} />
        <div className="scrim-hero" />
        <div className="wrap relative flex min-h-[420px] flex-col justify-end gap-6 pb-12 pt-28">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end">
            <Avatar name={org.name} src={org.logoUrl} size={96} className="!text-[30px]" />
            <div className="flex flex-col gap-3">
              <span className="tag">{KIND[org.kind] ?? 'Host'}</span>
              <h1 className="h1">{org.name}</h1>
              {org.shortDescription && <p className="lead max-w-[640px]">{org.shortDescription}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="wrap grid items-start gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="upcoming" className="flex flex-col gap-6">
          <h2 id="upcoming" className="text-[26px] text-strong">
            Upcoming events
          </h2>
          {events.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Nothing scheduled right now"
              body={`${org.name} hasn’t published any upcoming events yet. Check back soon.`}
            />
          ) : (
            <div className="cards">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>
        <aside className="card flex flex-col gap-5 p-6">
          <span className="eyebrow text-faint">About</span>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-body">
            {org.description || org.shortDescription || `${org.name} hosts events on Ekklesia.`}
          </p>
          {safeHttpUrl(org.websiteUrl) && (
            <>
              <div className="rule-x" />
              <a
                href={safeHttpUrl(org.websiteUrl)!}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-[15px] text-accent"
              >
                <Icon name="globe" /> {org.websiteUrl!.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

import { notFound } from 'next/navigation';
import { api, searchEvents } from '@/lib/api';
import type { Organization } from '@/lib/types';
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

  const website = safeHttpUrl(org.websiteUrl);
  const bio = org.description || org.shortDescription;

  return (
    <>
      {/* TODO(confirm): the design's host hero has no photo, so the host's
          cover image is no longer shown here. */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 120% at 90% 0%, rgba(var(--accent-rgb), 0.18), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(var(--accent-rgb), 0.08), transparent 60%)',
          }}
        />
        <div className="wrap relative flex flex-col gap-8 pb-16 pt-12">
          {/* TODO(confirm): the design starts with an "All hosts" link, and
              has a Follow button and a place line (area, city) beside the
              name. There's no hosts directory, follow API or public city yet. */}
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <Avatar name={org.name} src={org.logoUrl} size={104} className="!text-[35px]" />
            <div className="flex flex-col gap-3">
              <span className="tag self-start">{KIND[org.kind] ?? 'Host'}</span>
              <h1 className="h1">{org.name}</h1>
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 self-start text-[15px] text-accent"
                >
                  <Icon name="globe" size={16} />
                  {org.websiteUrl!.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
            </div>
          </div>
          {bio && <p className="max-w-[680px] whitespace-pre-line text-[17px] leading-[1.7] text-body">{bio}</p>}
          {/* TODO(confirm): the design also shows "Followers" and "On Ekklesia
              since"; neither is available from the API. */}
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            <div className="flex flex-col gap-1">
              <dt className="eyebrow text-[10px] text-faint">Upcoming events</dt>
              <dd className="text-[24px] text-strong">{events.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="upcoming" className="wrap pt-14">
        <h2 id="upcoming" className="mb-8 text-[30px] text-strong">
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
    </>
  );
}

import Link from 'next/link';
import type { Route } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

interface Org {
  id: string;
  slug: string;
  name: string;
  verificationStatus: string;
}

interface OrgEvent {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function loadDashboard(orgId: string) {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const init: RequestInit = { headers: { cookie: cookieHeader }, cache: 'no-store' };

  const meRes = await fetch(`${API}/v1/me`, init);
  if (!meRes.ok) return null;
  const me = (await meRes.json()) as {
    memberships: { organizationId: string; slug: string; name: string }[];
  };
  const m = me.memberships.find((x) => x.organizationId === orgId);
  if (!m) return null;

  const [orgRes, eventsRes] = await Promise.all([
    fetch(`${API}/v1/organizations/${m.slug}`, init),
    fetch(`${API}/v1/organizations/${orgId}/events`, init),
  ]);
  if (!orgRes.ok) return null;
  const org = (await orgRes.json()) as Org;
  const events: OrgEvent[] = eventsRes.ok ? await eventsRes.json() : [];
  return { org, events };
}

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const data = await loadDashboard(orgId);
  if (!data) notFound();
  const { org, events } = data;

  const published = events.filter((e) => e.status === 'PUBLISHED');
  const drafts = events.filter((e) => e.status === 'DRAFT' || e.status === 'SCHEDULED');
  const past = events.filter((e) => e.status === 'COMPLETED' || e.status === 'CANCELLED');

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-400">Church</p>
          <h1 className="mt-1 font-display text-3xl text-ink-900">{org.name}</h1>
          <p className="mt-1 text-sm text-ink-500">/{org.slug}</p>
        </div>
        <span className="rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-wider text-ink-600">
          {org.verificationStatus}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link
          href={`/organizer/organizations/${org.id}/events/new` as Route}
          className="rounded-lg border border-brand-300 bg-brand-50 p-6 hover:border-brand-500"
        >
          <p className="font-display text-lg text-ink-900">+ Create an event</p>
          <p className="mt-1 text-sm text-ink-600">Draft a gathering and publish when ready.</p>
        </Link>
        <div className="rounded-lg border border-ink-100 bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-ink-400">Verification</p>
          <p className="mt-2 text-sm text-ink-700">
            {org.verificationStatus === 'VERIFIED'
              ? 'Verified — listings are public.'
              : 'Unverified. Public publishing & payouts are gated.'}
          </p>
        </div>
        <div className="rounded-lg border border-ink-100 bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-ink-400">Public link</p>
          <Link
            href={`/${org.slug}` as Route}
            className="mt-2 block text-sm text-brand-700 hover:underline"
          >
            ekklesia.app/{org.slug}
          </Link>
        </div>
      </div>

      <EventSection
        title="Published"
        empty="Nothing live yet."
        events={published}
        org={org}
        live
      />
      <EventSection title="Drafts" empty="No drafts." events={drafts} org={org} />
      {past.length > 0 && (
        <EventSection title="Past or cancelled" empty="" events={past} org={org} muted />
      )}
    </div>
  );
}

function EventSection({
  title,
  empty,
  events,
  org,
  live,
  muted,
}: {
  title: string;
  empty: string;
  events: OrgEvent[];
  org: Org;
  live?: boolean;
  muted?: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-ink-900">{title}</h2>
        <p className="text-xs text-ink-400">{events.length}</p>
      </div>
      {events.length === 0 ? (
        empty ? <p className="mt-2 text-sm text-ink-400">{empty}</p> : null
      ) : (
        <ul className={`mt-4 grid gap-3 ${muted ? 'opacity-60' : ''}`}>
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-4 rounded-lg border border-ink-100 bg-white p-4"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-ink-100">
                {e.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.coverImageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink-900">{e.title}</p>
                <p className="text-xs text-ink-500">
                  {new Date(e.startsAt).toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {e.capacity !== null && (
                    <>
                      {' · '}
                      {e.attendeeCount}/{e.capacity} attending
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/organizer/organizations/${org.id}/events/${e.id}/edit` as Route}
                  className="rounded-md border border-ink-200 px-3 py-1.5 text-xs hover:bg-ink-100"
                >
                  Edit
                </Link>
                <Link
                  href={`/organizer/organizations/${org.id}/events/${e.id}/attendees` as Route}
                  className="rounded-md border border-ink-200 px-3 py-1.5 text-xs hover:bg-ink-100"
                >
                  Attendees
                </Link>
                {live && (
                  <Link
                    href={`/${org.slug}/${e.slug}` as Route}
                    target="_blank"
                    className="rounded-md border border-ink-200 px-3 py-1.5 text-xs hover:bg-ink-100"
                  >
                    View live ↗
                  </Link>
                )}
                <span className="rounded-md bg-ink-100 px-2.5 py-1 text-xs uppercase tracking-wider text-ink-600">
                  {e.status.toLowerCase()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

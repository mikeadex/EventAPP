import Link from 'next/link';
import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

interface Me {
  id: string;
  email: string;
  memberships: { organizationId: string; slug: string; name: string; role: string }[];
}

async function fetchMe(): Promise<Me | null> {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

export default async function OrganizerOverviewPage() {
  const me = await fetchMe();
  if (!me) redirect('/sign-in');

  const owning = me.memberships.filter((m) =>
    ['OWNER', 'CHURCH_ADMIN', 'ORGANIZER'].includes(m.role),
  );

  return (
    <div>
      <h1 className="font-display text-3xl text-ink-900">Welcome back</h1>
      <p className="mt-2 text-ink-500">Manage your church&apos;s events, attendees, and payouts.</p>

      {owning.length === 0 ? (
        <div className="mt-10 rounded-lg border border-brand-200 bg-brand-50 p-8">
          <p className="font-display text-xl text-ink-900">No churches yet</p>
          <p className="mt-1 text-ink-600">Register your church to start publishing events.</p>
          <Link
            href={'/organizer/organizations/new' as Route}
            className="mt-4 inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
          >
            Register a church
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {owning.map((m) => (
            <Link
              key={m.organizationId}
              href={`/organizer/organizations/${m.organizationId}` as Route}
              className="rounded-lg border border-ink-100 bg-white p-6 hover:border-brand-300"
            >
              <p className="text-xs uppercase tracking-wider text-ink-400">{m.role.toLowerCase()}</p>
              <p className="mt-1 font-display text-xl text-ink-900">{m.name}</p>
              <p className="mt-1 text-sm text-ink-500">/{m.slug}</p>
            </Link>
          ))}
          <Link
            href={'/organizer/organizations/new' as Route}
            className="rounded-lg border border-dashed border-ink-200 p-6 text-ink-500 hover:border-brand-300 hover:text-ink-700"
          >
            + Register another church
          </Link>
        </div>
      )}
    </div>
  );
}

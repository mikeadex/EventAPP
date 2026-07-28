import Link from 'next/link';
import { api } from '@/lib/api';

interface EventListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  startsAt: string;
  coverImageUrl: string | null;
  organization: { slug: string; name: string };
}

export const revalidate = 60;

export default async function EventsPage() {
  const data = await api<{ items: EventListItem[] }>('/v1/events?limit=20').catch(() => ({
    items: [],
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="font-display text-4xl text-ink-900">Upcoming events</h1>
      {data.items.length === 0 ? (
        <p className="mt-8 text-ink-500">
          No events yet — once churches publish, they&apos;ll show up here.
        </p>
      ) : (
        <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((e) => (
            <li key={e.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <Link href={`/${e.organization.slug}/${e.slug}` as never}>
                <div className="aspect-[16/9] bg-ink-100">
                  {e.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-wide text-brand-600">
                    {new Date(e.startsAt).toLocaleDateString()}
                  </p>
                  <h2 className="mt-1 font-medium text-ink-900">{e.title}</h2>
                  <p className="mt-1 text-sm text-ink-500">{e.organization.name}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import Link from 'next/link';
import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { TicketQr } from './[ticketId]/ticket-qr';

interface Ticket {
  id: string;
  code: string;
  status: string;
  issuedAt: string | null;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    coverImageUrl: string | null;
    organization: { slug: string; name: string; logoUrl: string | null };
  };
}

async function fetchTickets(): Promise<Ticket[] | null> {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/me/tickets`,
    { headers: { cookie: cookieHeader }, cache: 'no-store' },
  );
  if (res.status === 401) return null;
  if (!res.ok) return [];
  return (await res.json()) as Ticket[];
}

export default async function MyTicketsPage() {
  const tickets = await fetchTickets();
  if (tickets === null) redirect('/sign-in?next=/me/tickets');

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink-900">My tickets</h1>

      {tickets.length === 0 ? (
        <p className="mt-6 text-ink-500">
          You haven&apos;t RSVP&apos;d to anything yet.{' '}
          <Link href="/events" className="text-brand-700 hover:underline">
            Browse events
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {tickets.map((t) => (
            <li key={t.id} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
              <Link
                href={`/me/tickets/${t.id}` as Route}
                className="flex items-center gap-4 p-4 hover:bg-ink-50"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-ink-100">
                  {t.event.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.event.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-brand-600">
                    {new Date(t.event.startsAt).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="mt-1 font-medium text-ink-900">{t.event.title}</p>
                  <p className="text-sm text-ink-500">{t.event.organization.name}</p>
                  <p className="mt-1 font-mono text-xs text-ink-400">{t.code}</p>
                </div>
                <div className="shrink-0 rounded-md border border-ink-100 bg-white p-2">
                  <TicketQr value={t.code} size={72} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

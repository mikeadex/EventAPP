import Link from 'next/link';
import type { Route } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { TicketQr } from './ticket-qr';

interface Ticket {
  id: string;
  code: string;
  status: string;
  issuedAt: string | null;
  checkedInAt: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    isOnline: boolean;
    onlineUrl: string | null;
    coverImageUrl: string | null;
    organization: { slug: string; name: string; logoUrl: string | null };
    venue: {
      name: string;
      addressLine1: string;
      city: string;
      postalCode: string;
    } | null;
  };
}

async function fetchTicket(ticketId: string): Promise<Ticket | 'unauth' | null> {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/tickets/${ticketId}`,
    { headers: { cookie: cookieHeader }, cache: 'no-store' },
  );
  if (res.status === 401) return 'unauth';
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return (await res.json()) as Ticket;
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const ticket = await fetchTicket(ticketId);
  if (ticket === 'unauth') redirect(`/sign-in?next=/me/tickets/${ticketId}`);
  if (!ticket) notFound();

  const start = new Date(ticket.event.startsAt);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <Link
        href={'/me/tickets' as Route}
        className="text-sm text-ink-500 hover:text-ink-800"
      >
        ← All tickets
      </Link>

      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
        {/* Header strip */}
        <div className="border-b border-dashed border-ink-200 bg-brand-50 p-6 text-center">
          <p className="text-xs uppercase tracking-widest text-brand-700">
            {ticket.event.organization.name}
          </p>
          <h1 className="mt-2 font-display text-2xl leading-tight text-ink-900">
            {ticket.event.title}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {start.toLocaleString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="text-xs text-ink-400">{ticket.event.timezone}</p>
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center bg-white p-8">
          <div className="rounded-lg border border-ink-100 bg-white p-4">
            <TicketQr value={ticket.code} />
          </div>
          <p className="mt-4 font-mono text-sm tracking-wider text-ink-700">{ticket.code}</p>
          <p className="mt-1 text-xs text-ink-400">
            Show this code at the door. Don&apos;t share — one scan per ticket.
          </p>
        </div>

        {/* Footer info */}
        <div className="grid grid-cols-2 gap-4 border-t border-ink-100 bg-ink-50 p-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-400">Status</p>
            <p
              className={`mt-1 font-medium ${
                ticket.status === 'CHECKED_IN' ? 'text-success' : 'text-ink-800'
              }`}
            >
              {ticket.status.toLowerCase().replace('_', ' ')}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-400">
              {ticket.event.isOnline ? 'Joining' : 'Venue'}
            </p>
            <p className="mt-1 text-ink-800">
              {ticket.event.isOnline
                ? ticket.event.onlineUrl ?? 'Link to follow'
                : ticket.event.venue
                ? `${ticket.event.venue.name}, ${ticket.event.venue.city}`
                : 'TBA'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

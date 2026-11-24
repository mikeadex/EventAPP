import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { EventDetail } from '@/lib/types';
import { BackLink, EmptyState } from '@/components/ui';
import { RsvpForm } from './rsvp-form';

export const metadata: Metadata = { title: 'Reserve a place', robots: { index: false } };

type Params = Promise<{ orgSlug: string; eventSlug: string }>;

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ qty?: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { qty } = await searchParams;
  const href = `/${orgSlug}/${eventSlug}`;

  const event = await api<EventDetail>(`/v1/organizations/${orgSlug}/events/${eventSlug}`, {
    revalidate: false,
  }).catch(() => null);
  if (!event) notFound();

  const paid = event.ticketTypes.some((t) => t.priceMinor > 0);
  const ended = new Date(event.endsAt).getTime() < Date.now();
  const remaining = event.capacity !== null ? Math.max(0, event.capacity - event.attendeeCount) : null;

  let blocker: { title: string; body: string; action: React.ReactNode } | null = null;
  if (event.status === 'CANCELLED' || ended) {
    blocker = {
      title: event.status === 'CANCELLED' ? 'This event was cancelled' : 'This event has ended',
      body: 'Bookings are closed.',
      action: (
        <Link href="/events" className="btn btn-primary">
          Discover events
        </Link>
      ),
    };
  } else if (paid) {
    blocker = {
      title: 'This event has paid tickets',
      body: 'Online payment isn’t available yet. Contact the host to book.',
      action: (
        <Link href={href as never} className="btn btn-primary">
          Back to event
        </Link>
      ),
    };
  } else if (remaining === 0) {
    blocker = {
      title: 'Fully booked',
      body: 'Every place has been taken. Places sometimes free up — check back closer to the day.',
      action: (
        <Link href={href as never} className="btn btn-primary">
          Back to event
        </Link>
      ),
    };
  }

  return (
    <div className="wrap max-w-[1080px] pt-10">
      <BackLink href={href} className="mb-6">
        Back to event
      </BackLink>
      {blocker ? (
        <EmptyState icon="ticket" title={blocker.title} body={blocker.body} action={blocker.action} />
      ) : (
        <RsvpForm
          event={{
            id: event.id,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timezone: event.timezone,
            href,
            coverImageUrl: event.coverImageUrl,
            category: event.category,
            venueLine: event.venue
              ? [event.venue.name, event.venue.addressLine1, event.venue.city, event.venue.postalCode]
                  .filter(Boolean)
                  .join(', ')
              : 'Online',
            place: event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Online',
            host: event.organization.name,
            tierName: event.ticketTypes[0]?.name && event.ticketTypes[0].name !== 'RSVP' ? event.ticketTypes[0].name : 'Free place',
            tierDescription: event.ticketTypes[0]?.description ?? null,
            remaining,
          }}
          initialQty={Number(qty) || 1}
        />
      )}
    </div>
  );
}

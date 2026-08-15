import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { RsvpButton } from './rsvp-button';

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  organization: { slug: string; name: string; logoUrl: string | null };
  venue: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    country: string;
  } | null;
  ticketTypes: { id: string; name: string; priceMinor: number; currency: string }[];
}

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const event = await api<EventDetail | null>(
    `/v1/organizations/${orgSlug}/events/${eventSlug}`,
  ).catch(() => null);
  if (!event) return { title: 'Event not found' };
  return {
    title: event.title,
    description: event.summary ?? undefined,
    openGraph: {
      title: event.title,
      description: event.summary ?? undefined,
      images: event.coverImageUrl ? [event.coverImageUrl] : undefined,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const event = await api<EventDetail | null>(
    `/v1/organizations/${orgSlug}/events/${eventSlug}`,
  ).catch(() => null);
  if (!event) notFound();

  const isFree = event.ticketTypes.every((t) => t.priceMinor === 0);
  const seatsLeft = event.capacity !== null ? event.capacity - event.attendeeCount : null;
  const soldOut = seatsLeft !== null && seatsLeft <= 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {event.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverImageUrl}
          alt=""
          className="mb-8 aspect-[16/7] w-full rounded-xl object-cover"
        />
      )}

      <p className="text-sm uppercase tracking-wider text-brand-600">
        {event.organization.name}
      </p>
      <h1 className="mt-2 font-display text-4xl text-ink-900">{event.title}</h1>
      {event.summary && <p className="mt-3 text-lg text-ink-600">{event.summary}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="When">
          <p className="text-ink-900">
            {new Date(event.startsAt).toLocaleString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p className="text-sm text-ink-500">{event.timezone}</p>
        </InfoCard>
        {/* A hybrid event has both a venue and a stream, so this shows whichever
            of the two apply rather than treating them as alternatives. */}
        <InfoCard
          label={event.isOnline ? (event.venue ? 'Where & online' : 'Online') : 'Where'}
        >
          {event.venue ? (
            <>
              <p className="text-ink-900">{event.venue.name}</p>
              <p className="text-sm text-ink-500">
                {event.venue.addressLine1}, {event.venue.city} {event.venue.postalCode}
              </p>
            </>
          ) : event.isOnline ? null : (
            <p className="text-ink-500">Location TBA</p>
          )}
          {event.isOnline && (
            <p className={event.venue ? 'mt-2 text-sm text-ink-500' : 'text-ink-900'}>
              {event.venue ? 'Also streamed online.' : 'Online — link shared after RSVP.'}
            </p>
          )}
        </InfoCard>
      </div>

      {event.description && (
        <div className="mt-8 whitespace-pre-line text-ink-700">{event.description}</div>
      )}

      <div className="mt-10 rounded-xl border border-ink-100 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-400">RSVP</p>
            <p className="mt-1 font-display text-2xl text-ink-900">
              {isFree ? 'Free' : 'Paid (Phase 4)'}
            </p>
            {seatsLeft !== null && (
              <p className="mt-1 text-sm text-ink-500">
                {soldOut ? 'At capacity' : `${seatsLeft} of ${event.capacity} spots left`}
              </p>
            )}
          </div>
          <RsvpButton eventId={event.id} disabled={!isFree || soldOut} />
        </div>
      </div>
    </main>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-ink-400">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

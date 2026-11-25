import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import { categoryOf } from '@/lib/categories';
import {
  fmtDateLong,
  fmtDayMonth,
  fmtTime,
  fmtWeekday,
  fmtYear,
  mapsUrl,
  plural,
  tiersPrice,
} from '@/lib/format';
import type { EventDetail, Organization } from '@/lib/types';
import { Cover } from '@/components/cover';
import { SaveButton, ShareButton } from '@/components/client';
import { Icon } from '@/components/icons';
import { Avatar } from '@/components/ui';
import { UnclaimedNote } from '@/components/unclaimed-note';
import { BookingPanel, MobileBookingBar } from './booking-panel';

export const revalidate = 60;

type Params = Promise<{ orgSlug: string; eventSlug: string }>;

async function load(orgSlug: string, eventSlug: string) {
  return api<EventDetail>(`/v1/organizations/${orgSlug}/events/${eventSlug}`).catch(() => null);
}

export async function generateMetadata({ params }: { params: Params }) {
  const { orgSlug, eventSlug } = await params;
  const event = await load(orgSlug, eventSlug);
  if (!event) return { title: 'Event not found' };
  return {
    title: event.title,
    description: event.summary ?? undefined,
    alternates: { canonical: `/${orgSlug}/${eventSlug}` },
    openGraph: {
      title: event.title,
      description: event.summary ?? undefined,
      images: event.coverImageUrl ? [event.coverImageUrl] : undefined,
    },
  };
}

export default async function EventDetailPage({ params }: { params: Params }) {
  const { orgSlug, eventSlug } = await params;
  const event = await load(orgSlug, eventSlug);
  if (!event) notFound();

  const [org, going] = await Promise.all([
    api<Organization>(`/v1/organizations/${orgSlug}`, { revalidate: 300 }).catch(() => null),
    api<{ items: { name: string; image: string | null }[]; total: number }>(
      `/v1/events/${event.id}/attendees`,
    ).catch(() => null),
  ]);

  const tz = event.timezone;
  const remaining = event.capacity !== null ? Math.max(0, event.capacity - event.attendeeCount) : null;
  const ended = new Date(event.endsAt).getTime() < Date.now();
  const spots =
    remaining === null ? 'Open to all' : remaining === 0 ? 'Fully booked' : `${plural(remaining, 'spot')} left`;
  const sameDay = fmtDateLong(event.startsAt, tz) === fmtDateLong(event.endsAt, tz);
  const description = (event.description ?? event.summary ?? '').split(/\n{2,}/).filter(Boolean);
  const where = event.venue
    ? { name: event.venue.name, line: [event.venue.addressLine1, event.venue.city, event.venue.postalCode].filter(Boolean).join(', ') }
    : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.summary ?? undefined,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus:
      event.status === 'CANCELLED' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.isOnline
      ? event.venue
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    image: event.coverImageUrl ? [event.coverImageUrl] : undefined,
    location: event.venue
      ? {
          '@type': 'Place',
          name: event.venue.name,
          address: {
            '@type': 'PostalAddress',
            streetAddress: event.venue.addressLine1,
            addressLocality: event.venue.city,
            postalCode: event.venue.postalCode,
            addressCountry: event.venue.country,
          },
        }
      : { '@type': 'VirtualLocation', url: `/${orgSlug}/${eventSlug}` },
    organizer: { '@type': 'Organization', name: event.organization.name, url: `/${orgSlug}` },
    offers: (event.ticketTypes.length ? event.ticketTypes : [{ name: 'RSVP', priceMinor: 0, currency: 'GBP' }]).map(
      (t) => ({
        '@type': 'Offer',
        name: t.name,
        price: (t.priceMinor / 100).toFixed(2),
        priceCurrency: t.currency,
        availability: remaining === 0 ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      }),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped cannot close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Hero: full-bleed under the glass header */}
      <section className="relative -mt-[72px] min-h-[600px] overflow-hidden">
        <Cover image={event.coverImageUrl} category={event.category} title={event.title} />
        <div className="scrim-hero" />
        <div className="wrap relative flex min-h-[600px] flex-col pb-14 pt-24">
          <Link
            href="/events"
            className="glass inline-flex items-center gap-2 self-start rounded-full border border-line-2 px-4 py-2 text-[14px]"
          >
            <Icon name="arrowLeft" size={16} /> All events
          </Link>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-[760px] flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <span className="tag">{categoryOf(event.category).label}</span>
                {event.status === 'CANCELLED' && <span className="tag-solid">Cancelled</span>}
                {ended && event.status !== 'CANCELLED' && <span className="tag-muted">Past event</span>}
              </div>
              <h1 className="display sm:!text-[64px]">{event.title}</h1>
              {event.attendeeCount > 0 && (
                <div className="flex items-center gap-3">
                  {going && going.items.length > 0 && (
                    <span className="flex" aria-hidden="true">
                      {going.items.slice(0, 3).map((p, i) => (
                        <Avatar key={i} name={p.name} src={p.image} size={32} className={`!border-accent ${i ? '-ml-[9px]' : ''}`} />
                      ))}
                    </span>
                  )}
                  <span className="text-[15px] text-ink-2">{plural(event.attendeeCount, 'person', 'people')} going</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <ShareButton title={event.title} />
              <Suspense fallback={null}>
                <SaveButton eventId={event.id} title={event.title} size="lg" />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap grid items-start gap-16 pt-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-12">
          {/* Under the header rather than on the photo, where it could not be read. */}
          <UnclaimedNote
            claimStatus={event.organization.claimStatus}
            name={event.organization.name}
            className="-mb-10 -mt-3"
          />
          {/* Location · Date · Time with fading dividers */}
          <dl className="card grid gap-5 p-6 sm:grid-cols-[minmax(0,1.3fr)_1px_minmax(0,1fr)_1px_minmax(0,0.8fr)]">
            <Fact label="Location" value={where?.name ?? 'Online'} sub={event.venue?.city ?? (event.isOnline ? 'Link shared after RSVP' : '')} />
            <div className="rule-y hidden sm:block" aria-hidden="true" />
            <Fact label="Date" value={`${fmtWeekday(event.startsAt, tz).slice(0, 3)} ${fmtDayMonth(event.startsAt, tz)}`} sub={fmtYear(event.startsAt, tz)} />
            <div className="rule-y hidden sm:block" aria-hidden="true" />
            <Fact label="Time" value={fmtTime(event.startsAt, tz)} sub={`until ${fmtTime(event.endsAt, tz)}`} />
          </dl>

          <section aria-labelledby="about" className="flex flex-col gap-4">
            <h2 id="about" className="text-[26px] text-strong">
              About this event
            </h2>
            {description.length ? (
              description.map((p, i) => (
                <p key={i} className="max-w-[680px] whitespace-pre-line text-[17px] leading-[1.7] text-body">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-[17px] text-body">The host hasn’t added a description yet.</p>
            )}
            <p className="flex items-center gap-2.5 text-[14px] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {spots}
            </p>
          </section>

          <section aria-labelledby="where" className="flex flex-col gap-5">
            <h2 id="where" className="text-[26px] text-strong">
              When and where
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
              <div className="card flex flex-col gap-4 p-6 text-[15px]">
                <span className="flex items-center gap-3">
                  <Icon name="calendar" className="text-accent" />
                  {fmtDateLong(event.startsAt, tz)}
                  {!sameDay && ` – ${fmtDateLong(event.endsAt, tz)}`}
                </span>
                <span className="flex items-center gap-3">
                  <Icon name="clock" className="text-accent" />
                  {fmtTime(event.startsAt, tz)} – {fmtTime(event.endsAt, tz)}
                  {tz === 'Europe/London' ? ' (UK time)' : ` (${tzName(event.startsAt, tz)})`}
                </span>
                <span className="flex items-center gap-3">
                  <Icon name="users" className="text-accent" />
                  {event.capacity ? `Capacity ${event.capacity}` : 'No capacity limit'}
                </span>
                {event.isOnline && (
                  <span className="flex items-center gap-3">
                    <Icon name="globe" className="text-accent" />
                    {event.venue ? 'Also streamed online' : 'Online event'} · link on your ticket
                  </span>
                )}
              </div>
              {event.venue && where ? (
                <a
                  href={mapsUrl(event.venue)}
                  target="_blank"
                  rel="noreferrer"
                  className="card card-link relative flex min-h-[170px] flex-col justify-end overflow-hidden !bg-raised p-6"
                >
                  <MapPattern />
                  <span className="relative flex flex-col gap-1 rounded-[14px] p-3.5" style={{ background: 'rgba(var(--scrim), 0.8)' }}>
                    <span className="text-[17px] text-strong">{where.name}</span>
                    <span className="text-[14px] text-ink-2">{where.line}</span>
                    <span className="text-[14px] text-accent">Open in Maps ↗</span>
                  </span>
                </a>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="host" className="flex flex-col gap-5">
            <h2 id="host" className="text-[26px] text-strong">
              Hosted by
            </h2>
            <Link
              href={`/${orgSlug}` as never}
              className="card card-link flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center"
            >
              <Avatar name={event.organization.name} src={event.organization.logoUrl} size={64} />
              <span className="flex flex-col gap-1.5">
                <span className="eyebrow text-[10px] text-accent">{(org?.kind ?? 'Church').toLowerCase()}</span>
                <span className="text-[20px] text-strong">{event.organization.name}</span>
                {org?.shortDescription && (
                  <span className="text-[15px] leading-relaxed text-body">{org.shortDescription}</span>
                )}
              </span>
            </Link>
          </section>
        </div>

        <BookingPanel
          event={{
            id: event.id,
            status: event.status,
            ended,
            remaining,
            href: `/${orgSlug}/${eventSlug}`,
            tiers: event.ticketTypes,
          }}
        />
      </div>

      <MobileBookingBar
        price={tiersPrice(event.ticketTypes)}
        spots={spots}
        closed={ended || event.status === 'CANCELLED'}
      />
    </>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="eyebrow text-[10px] text-faint">{label}</dt>
      <dd className="text-[19px] leading-snug">{value}</dd>
      {sub && <dd className="text-[13px] text-muted">{sub}</dd>}
    </div>
  );
}

/** Short zone name, e.g. "CET", for events outside the UK. */
function tzName(iso: string, tz: string) {
  const part = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(new Date(iso))
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? tz;
}

/** The design's map artwork: a slanted street grid, a road and a pin. */
function MapPattern() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
      <g stroke="rgba(var(--accent-rgb), 0.12)" fill="none">
        <path d="M0 0 L-30 200M36 0 L6 200M72 0 L42 200M108 0 L78 200M144 0 L114 200M180 0 L150 200M216 0 L186 200M252 0 L222 200M288 0 L258 200M324 0 L294 200M360 0 L330 200M396 0 L366 200" />
        <path d="M0 0 L400 14M0 32 L400 46M0 64 L400 78M0 96 L400 110M0 128 L400 142M0 160 L400 174M0 192 L400 206" />
      </g>
      <path
        d="M-10 140 C 80 110, 160 170, 260 120 S 380 60, 420 80"
        stroke="rgba(var(--accent-rgb), 0.35)"
        strokeWidth="10"
        fill="none"
      />
      <circle cx="300" cy="62" r="34" fill="rgba(var(--accent-rgb), 0.12)" />
      <circle cx="300" cy="62" r="7" fill="var(--accent)" />
    </svg>
  );
}

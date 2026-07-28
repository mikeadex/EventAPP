/**
 * Demo content seed — hosts, venues and a spread of upcoming events.
 *
 * Kept separate from `seed.ts` (feature flags + admin) because this is
 * *deliberate* demo data: you want it in a beta/preview environment so testers
 * see a populated app, but you do not want it appearing automatically on every
 * deploy of a real production database.
 *
 *   pnpm --filter @ekklesia/api db:seed:demo
 *
 * Dates are all relative to the moment it runs. The first version of this data
 * used hard-coded July dates and silently rotted — by the time the app was
 * deployed the events were in the past and Discover (which filters to
 * `startsAt > now`) rendered empty. Offsets keep the demo permanently valid.
 *
 * Idempotent: every record is upserted against a stable id, so re-running
 * refreshes the dates rather than creating duplicates.
 */
import { PrismaClient, type EventCategory } from '@prisma/client';

const prisma = new PrismaClient();

const TZ = 'Europe/London';

/** `days` from now at `hour`:`minute` local, as a Date. */
function inDays(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const ORGS = [
  {
    id: 'seedorg-lsc',
    slug: 'love-salvation-church',
    name: 'Love Salvation Church',
    kind: 'CHURCH' as const,
    country: 'GB',
    currency: 'GBP',
    shortDescription: 'A city-centre church family in East London.',
  },
  {
    id: 'seedorg-grace',
    slug: 'grace-community',
    name: 'Grace Community',
    kind: 'CHURCH' as const,
    country: 'GB',
    currency: 'GBP',
    shortDescription: 'Rooted in the north, serving the whole city.',
  },
];

const VENUES = [
  {
    id: 'seedvenue-ldn',
    name: 'Grace Hall',
    addressLine1: '1 Faith Street',
    city: 'London',
    postalCode: 'E1 6AN',
    country: 'GB',
  },
  {
    id: 'seedvenue-mcr',
    name: 'Hope Centre',
    addressLine1: '12 Deansgate',
    city: 'Manchester',
    postalCode: 'M3 2BW',
    country: 'GB',
  },
];

/**
 * Offsets are chosen so the app always has: a hero event within days, enough
 * entries to fill both Discover carousels, something inside "This month", and
 * a couple of cities for the location picker.
 */
const EVENTS = [
  {
    id: 'seedevt01', slug: 'worship-night', title: 'Worship Night',
    category: 'WORSHIP', summary: 'An evening of worship and prayer',
    org: 'seedorg-lsc', venue: 'seedvenue-ldn',
    startDays: 3, hour: 19, durationHours: 2.5, capacity: 250, going: 39,
    cover: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt06', slug: 'morning-prayer', title: 'Morning Prayer',
    category: 'PRAYER', summary: 'Start the day in prayer',
    org: 'seedorg-lsc', venue: 'seedvenue-ldn',
    startDays: 5, hour: 7, durationHours: 1, capacity: 60, going: 19,
    cover: 'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt04', slug: 'community-bbq', title: 'Community BBQ',
    category: 'SOCIAL', summary: 'Food, fun and fellowship',
    org: 'seedorg-grace', venue: 'seedvenue-mcr',
    startDays: 8, hour: 13, durationHours: 4, capacity: 150, going: 67,
    cover: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt02', slug: 'leadership-conference', title: 'Leadership Conference',
    category: 'CONFERENCE', summary: 'Equipping the next generation of leaders',
    org: 'seedorg-grace', venue: 'seedvenue-ldn',
    startDays: 12, hour: 10, durationHours: 8, capacity: 300, going: 122,
    cover: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt08', slug: 'kids-fun-day', title: 'Kids Fun Day',
    category: 'KIDS', summary: 'A morning of games and crafts',
    org: 'seedorg-lsc', venue: 'seedvenue-ldn',
    startDays: 18, hour: 11, durationHours: 3, capacity: 100, going: 73,
    cover: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt03', slug: 'youth-summer-camp', title: 'Youth Summer Camp',
    category: 'YOUTH', summary: 'Adventure, faith and friendship',
    org: 'seedorg-grace', venue: 'seedvenue-mcr',
    startDays: 25, hour: 11, durationHours: 48, capacity: 80, going: 55,
    cover: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt05', slug: 'city-outreach-day', title: 'City Outreach Day',
    category: 'OUTREACH', summary: 'Serving our city together',
    org: 'seedorg-lsc', venue: 'seedvenue-ldn',
    startDays: 33, hour: 9, durationHours: 6, capacity: 120, going: 41,
    cover: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt07', slug: 'alpha-course', title: 'Alpha Course',
    category: 'CLASS', summary: 'Explore life, faith and meaning',
    org: 'seedorg-grace', venue: 'seedvenue-mcr',
    startDays: 45, hour: 20, durationHours: 2, capacity: 40, going: 12,
    cover: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1000&q=72',
  },
  {
    id: 'seedevt09', slug: 'charity-gala-dinner', title: 'Charity Gala Dinner',
    category: 'FUNDRAISER', summary: 'An evening for a good cause',
    org: 'seedorg-lsc', venue: 'seedvenue-ldn',
    startDays: 60, hour: 19, durationHours: 4, capacity: 200, going: 88,
    cover: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1000&q=72',
  },
] as const;

async function main() {
  // Upsert organisations on `slug`, their natural unique key, not on id. An
  // environment may already have a host with the same slug under a different
  // id (dev databases accumulate them); keying on id would try to insert and
  // trip the unique constraint. Resolve the real id for the event rows below.
  const orgIdBySeedId = new Map<string, string>();
  for (const { id: seedId, ...o } of ORGS) {
    const row = await prisma.organization.upsert({
      where: { slug: o.slug },
      update: { name: o.name, shortDescription: o.shortDescription },
      create: { ...o },
      select: { id: true },
    });
    orgIdBySeedId.set(seedId, row.id);
  }

  for (const v of VENUES) {
    await prisma.venue.upsert({ where: { id: v.id }, update: { ...v }, create: { ...v } });
  }

  for (const e of EVENTS) {
    const startsAt = inDays(e.startDays, e.hour);
    const endsAt = new Date(startsAt.getTime() + e.durationHours * 60 * 60 * 1000);

    const organizationId = orgIdBySeedId.get(e.org);
    if (!organizationId) throw new Error(`No organisation resolved for ${e.org}`);

    const data = {
      slug: e.slug,
      organizationId,
      venueId: e.venue,
      title: e.title,
      summary: e.summary,
      category: e.category as EventCategory,
      status: 'PUBLISHED' as const,
      visibility: 'PUBLIC' as const,
      startsAt,
      endsAt,
      timezone: TZ,
      isOnline: false,
      capacity: e.capacity,
      attendeeCount: e.going,
      coverImageUrl: e.cover,
      publishedAt: new Date(),
    };

    await prisma.event.upsert({ where: { id: e.id }, update: data, create: { id: e.id, ...data } });

    // One free RSVP tier per event, so the app's "Free" filter and the
    // "Get a Ticket · Free" CTA have something real to act on.
    const ticketTypeId = `${e.id}-free`;
    const ticket = {
      eventId: e.id,
      name: 'General Admission',
      priceMinor: 0,
      currency: 'GBP',
      quantity: e.capacity,
    };
    await prisma.ticketType.upsert({
      where: { id: ticketTypeId },
      update: ticket,
      create: { id: ticketTypeId, ...ticket },
    });

    // Be authoritative for our own demo events: drop any other tiers left over
    // from earlier seeding, so an event doesn't end up offering two identical
    // "General Admission" options. Scoped to seed events only — never touches
    // tiers belonging to real organiser-created events.
    await prisma.ticketType.deleteMany({
      where: { eventId: e.id, id: { not: ticketTypeId }, sold: 0 },
    });
  }

  const first = inDays(EVENTS[0].startDays, EVENTS[0].hour);
  console.log(
    `Demo seed complete: ${ORGS.length} hosts, ${VENUES.length} venues, ${EVENTS.length} events ` +
      `(next: ${EVENTS[0].title} on ${first.toDateString()}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

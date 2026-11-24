import type { Metadata } from 'next';
import { Suspense } from 'react';
import { nowRounded, searchEvents } from '@/lib/api';
import { categoryOf, isCategory } from '@/lib/categories';
import { EventCard, EventCardSkeleton } from '@/components/event-card';
import { PageIntro } from '@/components/ui';
import { DiscoverFilters, DiscoverEmpty, SearchBox } from './filters';

export const metadata: Metadata = {
  title: 'Discover events',
  description: 'Events from churches, ministries and faith communities near you.',
};

type Params = { q?: string; category?: string; when?: string; price?: string; sort?: string };
const DAY = 86_400_000;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  return (
    <div className="wrap pt-12">
      <PageIntro
        eyebrow="Discover"
        title="What’s on"
        intro="Events from churches, ministries and faith communities. Browse freely — you only sign in to RSVP."
      />
      <div className="grid items-start gap-12 md:grid-cols-[260px_minmax(0,1fr)]">
        <Suspense fallback={null}>
          <DiscoverFilters />
        </Suspense>
        <div className="flex min-w-0 flex-col gap-6">
          <Suspense fallback={<div className="skeleton h-[52px] w-full !rounded-full" />}>
            <SearchBox />
          </Suspense>
          {/* Keyed on the query so a filter change shows skeletons, not stale cards. */}
          <Suspense key={JSON.stringify(sp)} fallback={<ResultsSkeleton />}>
            <Results sp={sp} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Results({ sp }: { sp: Params }) {
  const category = isCategory(sp.category) ? sp.category : undefined;
  const now = Date.parse(nowRounded());
  const when = sp.when;
  const data = await searchEvents({
    q: sp.q?.trim() || undefined,
    category,
    free: sp.price === 'free',
    startsAfter: when === 'later' ? new Date(now + 30 * DAY).toISOString() : undefined,
    startsBefore:
      when === 'week'
        ? new Date(now + 7 * DAY).toISOString()
        : when === 'month'
          ? new Date(now + 30 * DAY).toISOString()
          : undefined,
    limit: 50,
  }).catch(() => null);

  if (!data) {
    return (
      <>
        <p aria-live="polite" className="text-[14px] text-faint">
          Couldn’t load events
        </p>
        <DiscoverEmpty failed />
      </>
    );
  }

  let items = data.items;
  // The API has no "paid only" or popularity sort, so those two happen here.
  if (sp.price === 'paid') items = items.filter((e) => !e.isFree);
  if (sp.sort === 'popular') items = [...items].sort((a, b) => b.attendeeCount - a.attendeeCount);

  const n = items.length;
  const summary =
    `${n} ${n === 1 ? 'event' : 'events'}` +
    (category ? ` in ${categoryOf(category).label}` : '') +
    (sp.q ? ` matching “${sp.q}”` : '');

  return (
    <>
      <p aria-live="polite" className="text-[14px] text-faint">
        {summary}
      </p>
      {n === 0 ? (
        <DiscoverEmpty />
      ) : (
        <div className="cards">
          {items.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </>
  );
}

function ResultsSkeleton() {
  return (
    <>
      <div className="skeleton h-4 w-32" />
      <div className="cards">
        {Array.from({ length: 6 }, (_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

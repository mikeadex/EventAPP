'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SaveButton } from '@/components/client';
import { Cover } from '@/components/cover';
import { EventCardSkeleton } from '@/components/event-card';
import { EmptyState, ErrorCard, PageIntro } from '@/components/ui';
import { fmtWhen } from '@/lib/format';
import type { SavedEvent } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';
import { eventHref } from '@/lib/url';

export function SavedList() {
  const { ready } = useRequireSession();
  const saved = useApi<SavedEvent[]>(ready ? '/v1/me/saved-events' : null);
  // Unsaving from this page hides the card; re-saving (before leaving) brings it back.
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const now = Date.now();
  const items = (saved.data ?? []).filter((s) => !hidden.has(s.event.id));
  const upcoming = items.filter((s) => new Date(s.event.startsAt).getTime() >= now);
  const past = items.filter((s) => new Date(s.event.startsAt).getTime() < now);

  return (
    <>
      <PageIntro eyebrow="Saved" title="Events you’ve saved" intro="Keep an eye on things you might go to." />
      {saved.status === 'loading' ? (
        <div className="cards" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : saved.status === 'error' ? (
        <ErrorCard
          message={saved.error}
          action={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void saved.reload()}>
              Try again
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Nothing saved yet"
          body="Tap the heart on any event to keep it here."
          action={
            <Link href="/events" className="btn btn-primary">
              Discover events
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-14">
          {upcoming.length > 0 && (
            <div className="cards">
              {upcoming.map((s) => (
                <SavedCard key={s.event.id} item={s} onUnsave={(id) => setHidden((h) => new Set(h).add(id))} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <section className="flex flex-col gap-6">
              <h2 className="text-[22px] text-strong">Already happened</h2>
              <div className="cards opacity-70">
                {past.map((s) => (
                  <SavedCard key={s.event.id} item={s} onUnsave={(id) => setHidden((h) => new Set(h).add(id))} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function SavedCard({ item, onUnsave }: { item: SavedEvent; onUnsave: (id: string) => void }) {
  const e = item.event;
  return (
    <article className="card card-link group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
          <Cover image={e.coverImageUrl} category="OTHER" title={e.title} />
        </div>
        <span className="absolute right-3.5 top-3.5 z-10">
          <SaveButton eventId={e.id} title={e.title} onChange={(on) => !on && onUnsave(e.id)} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="eyebrow text-ink-2">{fmtWhen(e.startsAt)}</p>
        <h3 className="text-[21px] leading-tight text-strong">
          <Link href={eventHref(e) as never} className="after:absolute after:inset-0">
            {e.title}
          </Link>
        </h3>
        <p className="text-[15px] text-muted">{e.organization.name}</p>
      </div>
    </article>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EventCard, EventCardSkeleton } from '@/components/event-card';
import { Icon } from '@/components/icons';
import { EmptyState, ErrorCard, PageIntro } from '@/components/ui';
import type { SavedEvent } from '@/lib/types';
import { useApi, useRequireSession } from '@/lib/use-api';

export function SavedList() {
  const { ready } = useRequireSession();
  const saved = useApi<SavedEvent[]>(ready ? '/v1/me/saved-events' : null);
  // Unsaving from this page hides the card; re-saving (before leaving) brings it back.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string) => setHidden((h) => new Set(h).add(id));

  const now = Date.now();
  const items = (saved.data ?? []).filter((s) => !hidden.has(s.event.id));
  const upcoming = items.filter((s) => new Date(s.event.startsAt).getTime() >= now);
  const past = items.filter((s) => new Date(s.event.startsAt).getTime() < now);

  return (
    <>
      <PageIntro
        eyebrow="Saved"
        title="Saved events"
        intro="Events you’ve hearted. Synced with the Ekklesia app."
        action={
          <Link href="/events" className="btn btn-outline">
            Discover more <Icon name="arrowRight" size={16} />
          </Link>
        }
      />
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
          plain
          icon="heart"
          title="Nothing saved yet"
          body="Tap the heart on any event to keep it here for later."
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
                <EventCard key={s.event.id} event={s.event} onSavedChange={(on) => !on && hide(s.event.id)} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <section className="flex flex-col gap-6">
              <h2 className="text-[22px] text-strong">Already happened</h2>
              <div className="cards opacity-70">
                {past.map((s) => (
                  <EventCard key={s.event.id} event={s.event} onSavedChange={(on) => !on && hide(s.event.id)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

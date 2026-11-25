import Link from 'next/link';
import { Suspense } from 'react';
import type { EventCardData } from '@/lib/types';
import { categoryOf } from '@/lib/categories';
import { cardPrice, fmtWhen } from '@/lib/format';
import { eventHref } from '@/lib/url';
import { Cover } from './cover';
import { SaveButton } from './client';
import { Icon } from './icons';

/** Grid card — photo on top, details below. */
export function EventCard({
  event,
  status,
  onSavedChange,
}: {
  event: EventCardData;
  status?: string;
  /** Called after the heart toggles — Saved uses it to hide unsaved cards. */
  onSavedChange?: (saved: boolean) => void;
}) {
  const href = eventHref(event);
  return (
    <article className="card card-link group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <div className="absolute inset-0">
          <Cover image={event.coverImageUrl} category={event.category} title={event.title} />
        </div>
        <div className="pointer-events-none absolute inset-x-3.5 top-3.5 flex items-start justify-between">
          <span className="tag-solid">{categoryOf(event.category).label}</span>
          <span className="pointer-events-auto">
            <Suspense fallback={null}>
              <SaveButton eventId={event.id} title={event.title} onChange={onSavedChange} />
            </Suspense>
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="eyebrow text-ink-2">{fmtWhen(event.startsAt, event.timezone)}</p>
        <h3 className="text-[21px] leading-tight text-strong">
          <Link href={href as never} className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </h3>
        <p className="text-[15px] text-muted">{event.organization.name}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-[14px]">
          {status ? (
            <span className="tag-muted">{status}</span>
          ) : (
            <span className="text-accent">{cardPrice(event)}</span>
          )}
          <span className="text-faint">{event.attendeeCount} going</span>
        </div>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[16/10] !rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-6 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
      </div>
    </div>
  );
}

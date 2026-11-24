'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CATEGORIES } from '@/lib/categories';
import { Icon } from '@/components/icons';
import { EmptyState } from '@/components/ui';

const WHEN = [
  ['', 'Any time'],
  ['week', 'Next 7 days'],
  ['month', 'Next 30 days'],
  ['later', 'Later'],
] as const;
const PRICE = [
  ['', 'Any price'],
  ['free', 'Free'],
  ['paid', 'Paid'],
] as const;

/** Filters live in the URL: shareable, and safe with the back button. */
function useFilterUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    startTransition(() => router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false }));
  }
  return { params, set };
}

export function DiscoverFilters() {
  const { params, set } = useFilterUrl();
  const cat = params.get('category') ?? '';
  const when = params.get('when') ?? '';
  const price = params.get('price') ?? '';
  const hasFilters = Boolean(cat || when || price);

  return (
    <aside aria-label="Filters" className="flex flex-col gap-8">
      <ChipGroup legend="Category">
        <button type="button" className="chip" aria-pressed={!cat} onClick={() => set({ category: null })}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className="chip"
            aria-pressed={cat === c.value}
            onClick={() => set({ category: cat === c.value ? null : c.value })}
          >
            {c.label}
          </button>
        ))}
      </ChipGroup>
      <ChipGroup legend="When">
        {WHEN.map(([v, label]) => (
          <button key={label} type="button" className="chip" aria-pressed={when === v} onClick={() => set({ when: v || null })}>
            {label}
          </button>
        ))}
      </ChipGroup>
      <ChipGroup legend="Price">
        {PRICE.map(([v, label]) => (
          <button key={label} type="button" className="chip" aria-pressed={price === v} onClick={() => set({ price: v || null })}>
            {label}
          </button>
        ))}
      </ChipGroup>
      {hasFilters && (
        <button
          type="button"
          onClick={() => set({ category: null, when: null, price: null, q: null })}
          className="self-start text-[14px] text-accent"
        >
          × Clear filters
        </button>
      )}
    </aside>
  );
}

function ChipGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="eyebrow mb-3 text-faint">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function SearchBox() {
  const { params, set } = useFilterUrl();
  const [q, setQ] = useState(params.get('q') ?? '');
  const sort = params.get('sort') ?? '';
  const first = useRef(true);

  // Follow the URL when it changes underneath us (back button, "Clear all").
  const urlQ = params.get('q') ?? '';
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  // Debounced: one navigation per pause in typing, not one per keystroke.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (q === urlQ) return;
    const t = setTimeout(() => set({ q: q.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="field h-[52px] flex-1">
        <Icon name="search" className="text-muted" />
        <span className="sr-only">Search events</span>
        <input
          type="search"
          placeholder="Search for events, venues or topics"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className="chip !h-[52px] !px-[18px]"
          aria-pressed={sort !== 'popular'}
          onClick={() => set({ sort: null })}
        >
          Soonest
        </button>
        <button
          type="button"
          className="chip !h-[52px] !px-[18px]"
          aria-pressed={sort === 'popular'}
          onClick={() => set({ sort: 'popular' })}
        >
          Most popular
        </button>
      </div>
    </div>
  );
}

export function DiscoverEmpty({ failed = false }: { failed?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  return failed ? (
    <EmptyState
      icon="alert"
      title="Events couldn’t be loaded"
      body="We couldn’t reach the events service. Check your connection and try again."
      action={
        <button type="button" className="btn btn-primary" onClick={() => router.refresh()}>
          Try again
        </button>
      }
    />
  ) : (
    <EmptyState
      plain
      icon="calendarX"
      title="No events match"
      body="Try a different search, or clear your filters to see everything on."
      action={
        <button type="button" className="btn btn-primary" onClick={() => router.replace(pathname as never, { scroll: false })}>
          Clear all
        </button>
      }
    />
  );
}

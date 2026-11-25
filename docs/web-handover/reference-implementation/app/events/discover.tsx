"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, SlidersHorizontal, X, CalendarX } from "@phosphor-icons/react";
import type { Category } from "@/lib/data";
import { categories, events } from "@/lib/data";
import { EventCard } from "@/components/event-card";

type When = "any" | "week" | "month" | "next";
type Price = "any" | "free" | "paid";
type Sort = "soonest" | "popular";

const whenLabels: Record<When, string> = { any: "Any time", week: "Next 7 days", month: "Next 30 days", next: "Later" };
const priceLabels: Record<Price, string> = { any: "Any price", free: "Free", paid: "Paid" };

export function Discover() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [showFilters, setShowFilters] = useState(false);

  const q = params.get("q") ?? "";
  const category = (params.get("category") as Category | null) ?? null;
  const when = (params.get("when") as When) || "any";
  const price = (params.get("price") as Price) || "any";
  const sort = (params.get("sort") as Sort) || "soonest";

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "" || value === "any" || (key === "sort" && value === "soonest")) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const results = useMemo(() => {
    const now = Date.now();
    const day = 86_400_000;
    const needle = q.trim().toLowerCase();
    return events
      .filter((e) => {
        const t = new Date(e.start).getTime();
        if (t < now - day) return false;
        if (category && e.category !== category) return false;
        if (needle && ![e.title, e.summary, e.venue, e.category].join(" ").toLowerCase().includes(needle)) return false;
        const isFree = e.tiers.every((x) => x.price === 0);
        if (price === "free" && !isFree) return false;
        if (price === "paid" && isFree) return false;
        if (when === "week" && t > now + 7 * day) return false;
        if (when === "month" && t > now + 30 * day) return false;
        if (when === "next" && t <= now + 30 * day) return false;
        return true;
      })
      .sort((a, b) => (sort === "popular" ? b.going - a.going : a.start.localeCompare(b.start)));
  }, [q, category, when, price, sort]);

  const active = [category, when !== "any" && whenLabels[when], price !== "any" && priceLabels[price]].filter(Boolean).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
      {/* Filters */}
      <aside
        aria-label="Filters"
        className={`${showFilters ? "flex" : "hidden"} flex-col gap-8 lg:sticky lg:top-24 lg:flex lg:self-start`}
      >
        <FilterGroup legend="Category">
          <Chip active={!category} onClick={() => set("category", null)}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => set("category", category === c ? null : c)}>
              {c}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup legend="When">
          {(Object.keys(whenLabels) as When[]).map((w) => (
            <Chip key={w} active={when === w} onClick={() => set("when", w)}>
              {whenLabels[w]}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup legend="Price">
          {(Object.keys(priceLabels) as Price[]).map((p) => (
            <Chip key={p} active={price === p} onClick={() => set("price", p)}>
              {priceLabels[p]}
            </Chip>
          ))}
        </FilterGroup>
        {active > 0 && (
          <button
            type="button"
            onClick={() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false })}
            className="inline-flex items-center gap-2 self-start text-[14px] text-accent"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex h-12 w-full items-center sm:flex-1 gap-3 rounded-full border border-line bg-surface px-5 focus-within:border-line-3">
            <MagnifyingGlass size={18} className="flex-none text-muted" />
            <span className="sr-only">Search events</span>
            <input
              type="search"
              defaultValue={q}
              placeholder="Search for events, venues or topics"
              onChange={(e) => set("q", e.target.value)}
              className="h-12 w-full bg-transparent text-[16px] text-ink placeholder:text-faint focus:outline-none"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line-2 px-5 text-[15px] text-ink lg:hidden"
            >
              <SlidersHorizontal size={17} className="text-accent" /> Filters{active ? ` (${active})` : ""}
            </button>
            <label className="relative inline-flex h-12 flex-1 items-center rounded-full border border-line-2 sm:flex-none">
              <span className="sr-only">Sort by</span>
              <select
                value={sort}
                onChange={(e) => set("sort", e.target.value)}
                className="h-full w-full appearance-none rounded-full bg-transparent pl-5 pr-10 text-[15px] text-ink focus:outline-none [&>option]:bg-surface"
              >
                <option value="soonest">Soonest first</option>
                <option value="popular">Most popular</option>
              </select>
              <svg className="pointer-events-none absolute right-4 size-3 text-muted" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                <path d="M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80A8 8 0 0 1 53.66 90.34L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z" />
              </svg>
            </label>
          </div>
        </div>

        <p className="text-[14px] text-faint" aria-live="polite">
          {results.length} {results.length === 1 ? "event" : "events"}
          {category ? ` in ${category}` : ""}
          {q ? ` matching “${q}”` : ""}
        </p>

        {results.length ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((e) => (
              <EventCard key={e.slug} event={e} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[20px] border border-line bg-surface px-6 py-20 text-center">
            <CalendarX size={40} className="text-faint" />
            <h2 className="text-[22px] text-strong">No events match</h2>
            <p className="max-w-sm text-[15px] text-body">Try a different search, or clear your filters to see everything on.</p>
            <button
              type="button"
              onClick={() => router.replace(pathname, { scroll: false })}
              className="mt-2 inline-flex h-11 items-center rounded-full border border-line-3 bg-accent-soft px-5 text-[15px] text-accent-ink"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-3 text-faint">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[14px] transition-colors ${
        active ? "border-line-3 bg-accent-soft text-accent" : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

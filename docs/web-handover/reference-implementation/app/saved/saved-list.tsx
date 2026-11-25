"use client";

import { useEffect, useState } from "react";
import { Heart } from "@phosphor-icons/react";
import { events } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { ButtonLink } from "@/components/ui";

export function SavedList() {
  const [slugs, setSlugs] = useState<string[] | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setSlugs(JSON.parse(localStorage.getItem("ek-saved") || "[]"));
      } catch {
        setSlugs([]);
      }
    };
    read();
    // keep in sync when hearts are toggled on this page or in another tab
    const id = window.setInterval(read, 600);
    window.addEventListener("storage", read);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (slugs === null) return <div className="h-64" />;

  const list = events.filter((e) => slugs.includes(e.slug));
  if (!list.length)
    return (
      <div className="flex flex-col items-center gap-4 rounded-[20px] border border-line bg-surface px-6 py-20 text-center">
        <Heart size={40} className="text-faint" />
        <h2 className="text-[22px] text-strong">Nothing saved yet</h2>
        <p className="max-w-sm text-[15px] text-body">Tap the heart on any event to keep it here for later.</p>
        <ButtonLink href="/events" className="mt-2">
          Discover events
        </ButtonLink>
      </div>
    );

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((e) => (
        <EventCard key={e.slug} event={e} />
      ))}
    </div>
  );
}

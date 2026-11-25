import Link from "next/link";
import { CalendarBlank, Clock, MapPin } from "@phosphor-icons/react/ssr";
import type { EventItem } from "@/lib/data";
import { getHost } from "@/lib/data";
import { fmtDay, fmtTime, priceLabel } from "@/lib/format";
import { Cover } from "./cover";
import { SaveButton } from "./client";
import { Dot, Tag } from "./ui";

/** Grid card — photo on top, details below (the Tickets / Saved list pattern, widened for desktop). */
export function EventCard({ event }: { event: EventItem }) {
  const host = getHost(event.hostSlug);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-line-2">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
          <Cover image={event.image} category={event.category} title={event.title} />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3.5">
          <Tag solid>{event.category}</Tag>
          <SaveButton slug={event.slug} title={event.title} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="eyebrow text-[11px] text-ink-2">
          {fmtDay(event.start)} at {fmtTime(event.start)}
        </p>
        <h3 className="text-[21px] leading-tight text-strong">
          <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {event.title}
          </Link>
        </h3>
        <p className="text-[15px] text-muted">{host?.name}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-[14px]">
          <span className="text-accent">{priceLabel(event)}</span>
          <span className="text-faint">{event.going} going</span>
        </div>
      </div>
    </article>
  );
}

/** Overlay card — title set over the photo with a scrim (the Discover "Happening soon" pattern). */
export function EventFeatureCard({ event, tall = false }: { event: EventItem; tall?: boolean }) {
  return (
    <article
      className={`group relative overflow-hidden rounded-[20px] border border-line bg-surface-2 ${tall ? "min-h-[420px]" : "min-h-[260px]"}`}
    >
      <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]">
        <Cover image={event.image} category={event.category} title={event.title} sizes="(min-width: 1024px) 50vw, 100vw" />
      </div>
      <div className="scrim-card absolute inset-0" />
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <Tag solid>{event.category}</Tag>
        <SaveButton slug={event.slug} title={event.title} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 md:p-6">
        <h3 className={`${tall ? "text-[30px] md:text-[34px]" : "text-[22px]"} leading-[1.05] text-strong`}>
          <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {event.title}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[14px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlank size={15} className="text-accent" /> {fmtDay(event.start)}
          </span>
          <Dot />
          <span className="inline-flex items-center gap-1.5">
            <Clock size={15} className="text-accent" /> {fmtTime(event.start)}
          </span>
          {tall && (
            <>
              <Dot />
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-accent" /> {event.venue}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

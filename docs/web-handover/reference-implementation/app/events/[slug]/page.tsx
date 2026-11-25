import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, ArrowSquareOut, Clock, CalendarBlank, Users } from "@phosphor-icons/react/ssr";
import { events, eventsByHost, getEvent, getHost } from "@/lib/data";
import { fmtDateLong, fmtDay, fmtTime, priceLabel, spotsLeft } from "@/lib/format";
import { Cover } from "@/components/cover";
import { SaveButton, ShareButton } from "@/components/client";
import { EventCard } from "@/components/event-card";
import { HostAvatar } from "@/components/host-card";
import { Container, Tag } from "@/components/ui";
import { BookingPanel } from "./booking-panel";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = getEvent((await params).slug);
  if (!e) return {};
  return {
    title: e.title,
    description: e.summary,
    openGraph: { title: e.title, description: e.summary, images: e.image ? [e.image] : undefined },
  };
}

export default async function EventPage({ params }: Props) {
  const event = getEvent((await params).slug);
  if (!event) notFound();
  const host = getHost(event.hostSlug)!;
  const more = eventsByHost(host.slug).filter((e) => e.slug !== event.slug).slice(0, 3);
  const left = spotsLeft(event);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.address}`)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start,
    endDate: event.end,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: event.venue, address: `${event.address}, ${event.city}` },
    description: event.summary,
    organizer: { "@type": "Organization", name: host.name },
    offers: event.tiers.map((t) => ({
      "@type": "Offer",
      name: t.name,
      price: t.price,
      priceCurrency: "GBP",
      availability: t.remaining > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero — the app's Details screen, widened */}
      <section className="relative -mt-[72px] min-h-[520px] overflow-hidden md:min-h-[600px]">
        <div className="absolute inset-0">
          <Cover image={event.image} category={event.category} title={event.title} priority sizes="100vw" />
        </div>
        <div className="scrim-hero absolute inset-0" />
        <Container className="relative flex min-h-[520px] flex-col pb-10 pt-[96px] md:min-h-[600px] md:pb-14">
          <Link
            href="/events"
            className="inline-flex items-center gap-2 self-start rounded-full border border-line-2 bg-[rgb(var(--scrim-rgb)/0.55)] px-4 py-2 text-[14px] text-ink backdrop-blur-md hover:text-accent"
          >
            <ArrowLeft size={15} /> All events
          </Link>
          <div className="mt-auto flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex max-w-3xl flex-col gap-4">
              <Tag>{event.category}</Tag>
              <h1 className="text-[42px] leading-[1.02] tracking-[-0.015em] text-strong text-balance md:text-[64px]">
                {event.title}
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex">
                  {["D", "M", "A"].map((l, i) => (
                    <span
                      key={l}
                      className="flex size-8 items-center justify-center rounded-full border border-accent bg-avatar text-[12px] text-accent"
                      style={{ marginLeft: i ? -9 : 0 }}
                      aria-hidden="true"
                    >
                      {l}
                    </span>
                  ))}
                </div>
                <span className="text-[15px] text-ink-2">{event.going} people going</span>
              </div>
            </div>
            <div className="flex gap-3">
              <ShareButton title={event.title} />
              <SaveButton slug={event.slug} title={event.title} size="lg" />
            </div>
          </div>
        </Container>
      </section>

      <Container className="grid gap-12 pt-10 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-12">
          {/* Location · Date · Time strip with faded dividers */}
          <dl className="grid grid-cols-[1.3fr_auto_1fr_auto_0.8fr] gap-4 rounded-[20px] border border-line bg-surface p-5 sm:gap-6 sm:p-6">
            <Fact label="Location" value={event.venue} sub={event.city} />
            <div className="rule-y" aria-hidden="true" />
            <Fact label="Date" value={fmtDay(event.start)} sub={new Date(event.start).getFullYear().toString()} />
            <div className="rule-y" aria-hidden="true" />
            <Fact label="Time" value={fmtTime(event.start)} sub={`until ${fmtTime(event.end)}`} />
          </dl>

          <section aria-labelledby="about" className="flex flex-col gap-4">
            <h2 id="about" className="text-[26px] text-strong">
              About this event
            </h2>
            {event.description.map((p, i) => (
              <p key={i} className="max-w-2xl text-[17px] leading-[1.7] text-body text-pretty">
                {p}
              </p>
            ))}
            <p className="flex items-center gap-2.5 text-[14px] text-accent">
              <span className="size-1.5 rounded-full bg-accent" /> {left} spots left
            </p>
          </section>

          <section aria-labelledby="when-where" className="flex flex-col gap-5">
            <h2 id="when-where" className="text-[26px] text-strong">
              When and where
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-6">
                <Row icon={<CalendarBlank size={18} />} text={fmtDateLong(event.start)} />
                <Row icon={<Clock size={18} />} text={`${fmtTime(event.start)} – ${fmtTime(event.end)} (UK time)`} />
                <Row icon={<Users size={18} />} text={`Capacity ${event.capacity}`} />
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="group relative flex min-h-[170px] flex-col justify-end overflow-hidden rounded-[20px] border border-line bg-raised p-6"
              >
                <MapArt />
                <span className="relative flex items-start gap-3">
                  <MapPin size={20} weight="fill" className="mt-0.5 flex-none text-accent" />
                  <span className="flex flex-col gap-1">
                    <span className="text-[17px] text-strong">{event.venue}</span>
                    <span className="text-[14px] text-ink-2">
                      {event.address}, {event.city}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[14px] text-accent group-hover:underline">
                      Open in Maps <ArrowSquareOut size={14} />
                    </span>
                  </span>
                </span>
              </a>
            </div>
          </section>

          <section aria-labelledby="host" className="flex flex-col gap-5">
            <h2 id="host" className="text-[26px] text-strong">
              Hosted by
            </h2>
            <Link
              href={`/hosts/${host.slug}`}
              className="flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-6 transition-colors hover:border-line-2 sm:flex-row sm:items-center"
            >
              <HostAvatar host={host} size={64} />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="eyebrow text-[10px] text-accent">{host.type}</span>
                <span className="text-[20px] text-strong">{host.name}</span>
                <span className="text-[15px] leading-relaxed text-body">{host.bio}</span>
              </span>
            </Link>
          </section>
        </div>

        <div id="book" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <BookingPanel event={event} />
        </div>
      </Container>

      {/* Mobile booking bar — keeps the action in reach, like the app's bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgb(var(--scrim-rgb)/0.92)] px-5 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-[17px] text-strong">{priceLabel(event)}</span>
            <span className="text-[12px] text-accent">{left} spots left</span>
          </span>
          <a
            href="#book"
            className="inline-flex h-12 items-center rounded-full border border-line-3 bg-accent-soft px-6 text-[15px] text-accent-ink"
          >
            {event.tiers.every((t) => t.price === 0) ? "Reserve a place" : "Get tickets"}
          </a>
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-24" aria-labelledby="more">
          <Container>
            <h2 id="more" className="mb-8 text-[30px] text-strong">
              More from {host.name}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {more.map((e) => (
                <EventCard key={e.slug} event={e} />
              ))}
            </div>
          </Container>
        </section>
      )}
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="eyebrow text-[10px] text-faint">{label}</dt>
      <dd className="text-[16px] leading-snug text-ink sm:text-[19px]">{value}</dd>
      {sub && <dd className="text-[13px] text-muted">{sub}</dd>}
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-3 text-[15px] text-ink">
      <span className="text-accent">{icon}</span>
      {text}
    </span>
  );
}

function MapArt() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 200">
      <g stroke="rgb(var(--accent-rgb) / 0.12)" strokeWidth="1" fill="none">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 36} y1="0" x2={i * 36 - 30} y2="200" />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 32} x2="400" y2={i * 32 + 14} />
        ))}
      </g>
      <path d="M-10 140 C 80 110, 160 170, 260 120 S 380 60, 420 80" stroke="rgb(var(--accent-rgb) / 0.35)" strokeWidth="10" fill="none" />
      <circle cx="300" cy="62" r="34" fill="rgb(var(--accent-rgb) / 0.12)" />
      <circle cx="300" cy="62" r="7" fill="var(--accent)" />
      <rect x="0" y="0" width="400" height="200" fill="url(#mapfade)" />
      <defs>
        <linearGradient id="mapfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.3" stopColor="var(--bg-raised)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--bg-raised)" stopOpacity="0.95" />
        </linearGradient>
      </defs>
    </svg>
  );
}

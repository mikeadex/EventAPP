import Link from "next/link";
import {
  ArrowRight,
  MagnifyingGlass,
  MapPin,
  QrCode,
  Ticket,
  Compass,
  Check,
  Plus,
} from "@phosphor-icons/react/ssr";
import type { Category } from "@/lib/data";
import { categories, events, getEvent, hosts, sortedEvents } from "@/lib/data";
import { fmtDay, fmtTime } from "@/lib/format";
import { EventCard, EventFeatureCard } from "@/components/event-card";
import { PhoneDiscover } from "@/components/phone";
import { StoreBadges } from "@/components/store-badges";
import { HostCard } from "@/components/host-card";
import { ButtonLink, Container, Eyebrow, SectionHeader } from "@/components/ui";
import { categoryIcons } from "@/components/category-icons";


const faqs = [
  {
    q: "Do I need an account to browse events?",
    a: "No. Anyone can browse every event and host. You only need to sign in when you RSVP or buy a ticket, so we can keep your tickets safe in one place.",
  },
  {
    q: "How do tickets work on the day?",
    a: "Each booking comes with a QR ticket in the app and in your confirmation email. The host scans it at the door — one scan per ticket.",
  },
  {
    q: "Can my church list its events?",
    a: "Yes. Churches, ministries and faith-based community groups can set up a host page in a few minutes and start publishing events straight away.",
  },
  {
    q: "Where is Ekklesia available?",
    a: "We're starting in London and the UK, with hosts in Ireland and the US able to join too. Events are shown in your local currency.",
  },
];

export default function HomePage() {
  const featured = getEvent("city-outreach-day")!;
  const next = getEvent("charity-gala-dinner")!;
  const soon = sortedEvents().slice(0, 6);
  const counts = Object.fromEntries(categories.map((c) => [c, events.filter((e) => e.category === c).length]));

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 size-[720px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--accent-rgb) / 0.18), transparent 65%)" }}
        />
        <Container className="relative grid items-center gap-14 pb-20 pt-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28">
          <div className="flex flex-col gap-7">
            <Eyebrow>Church &amp; community events · London</Eyebrow>
            <h1 className="text-[44px] leading-[1.02] tracking-[-0.02em] text-strong text-balance sm:text-[56px] lg:text-[68px]">
              Gatherings worth <span className="text-accent">showing up</span> for.
            </h1>
            <p className="max-w-xl text-[18px] leading-relaxed text-body text-pretty">
              Worship nights, conferences, courses and outreach from churches near you. RSVP in seconds and keep every
              ticket in one place.
            </p>

            <form action="/events" role="search" className="flex max-w-xl flex-col gap-3 sm:flex-row">
              <label className="flex h-14 w-full items-center sm:flex-1 gap-3 rounded-full border border-line bg-surface px-5 focus-within:border-line-3">
                <MagnifyingGlass size={18} className="flex-none text-muted" />
                <span className="sr-only">Search events</span>
                <input
                  name="q"
                  type="search"
                  placeholder="Search for events"
                  className="h-full w-full bg-transparent text-[16px] text-ink placeholder:text-faint focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-line-3 bg-accent-soft px-7 text-[16px] text-accent-ink transition-colors hover:border-accent"
              >
                Find events <ArrowRight size={17} />
              </button>
            </form>

            <ul className="flex flex-wrap gap-2" aria-label="Popular categories">
              {(["Worship", "Conference", "Youth", "Outreach", "Class"] as Category[]).map((c) => (
                <li key={c}>
                  <Link
                    href={`/events?category=${c}`}
                    className="inline-flex h-9 items-center rounded-full border border-line-2 px-4 text-[14px] text-ink-2 transition-colors hover:border-line-3 hover:text-accent"
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <EventFeatureCard event={featured} tall />
            {/* Ticket stub — echoes the app's QR ticket */}
            <div className="absolute right-4 top-24 hidden w-[280px] rounded-[20px] border border-line-2 bg-surface p-5 shadow-card sm:block lg:-right-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="eyebrow text-[10px] text-faint">Next up</span>
                  <span className="text-[17px] leading-tight text-strong">{next.title}</span>
                  <span className="text-[13px] text-ink-2">
                    {fmtDay(next.start)} · {fmtTime(next.start)}
                  </span>
                </div>
                <span className="flex size-12 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <QrCode size={26} />
                </span>
              </div>
              <div className="rule-x my-4" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] tracking-[0.14em] text-ink-2">EK-6BB5LAGSL3G</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] text-accent">
                  <span className="size-1.5 rounded-full bg-accent" /> Valid
                </span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- Happening soon ---------------- */}
      <section aria-label="Happening soon">
        <Container>
          <SectionHeader
            eyebrow="This month"
            title="Happening soon"
            action={
              <ButtonLink href="/events" variant="outline">
                See all events <ArrowRight size={16} />
              </ButtonLink>
            }
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((e) => (
              <EventCard key={e.slug} event={e} />
            ))}
          </div>
        </Container>
      </section>

      {/* ---------------- Categories ---------------- */}
      <section className="mt-28" aria-label="Browse by category">
        <Container>
          <SectionHeader eyebrow="Browse" title="Find your kind of gathering" />
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((c) => {
              const Icon = categoryIcons[c];
              return (
                <li key={c}>
                  <Link
                    href={`/events?category=${c}`}
                    className="group flex h-full flex-col gap-6 rounded-[20px] border border-line bg-surface p-5 transition-colors hover:border-line-3 md:p-6"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl border border-line-2 bg-accent-softer text-accent transition-colors group-hover:bg-accent-soft">
                      <Icon size={24} />
                    </span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="text-[19px] text-strong">{c}</span>
                      <span className="text-[13px] text-faint">
                        {counts[c]} {counts[c] === 1 ? "event" : "events"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="mt-28" aria-label="How it works">
        <Container>
          <div className="rounded-[28px] border border-line bg-raised px-6 py-12 md:px-12 md:py-16">
            <SectionHeader eyebrow="How it works" title="From discovering to the door in three taps" />
            <ol className="grid gap-10 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-8">
              {[
                {
                  icon: Compass,
                  t: "Discover",
                  d: "Browse events from churches and ministries near you — no account needed.",
                },
                {
                  icon: Ticket,
                  t: "RSVP or book",
                  d: "Reserve a free place or buy tickets, choose a tier or a table, and add a gift if you like.",
                },
                {
                  icon: QrCode,
                  t: "Show your QR",
                  d: "Your ticket lives in the app and your inbox. The host scans it at the door.",
                },
              ].flatMap((s, i, arr) => {
                const item = (
                  <li key={s.t} className="flex flex-col gap-4">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[13px] text-accent">0{i + 1}</span>
                      <s.icon size={22} className="text-accent" />
                    </span>
                    <span className="text-[22px] text-strong">{s.t}</span>
                    <span className="text-[15px] leading-relaxed text-body">{s.d}</span>
                  </li>
                );
                return i < arr.length - 1
                  ? [item, <li key={`r${i}`} aria-hidden="true" className="rule-y hidden md:block" />]
                  : [item];
              })}
            </ol>
          </div>
        </Container>
      </section>

      {/* ---------------- Hosts ---------------- */}
      <section className="mt-28" aria-label="Featured hosts">
        <Container>
          <SectionHeader
            eyebrow="Hosts"
            title="Churches and ministries on Ekklesia"
            action={
              <ButtonLink href="/hosts" variant="outline">
                Browse hosts <ArrowRight size={16} />
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hosts.slice(0, 3).map((h) => (
              <HostCard key={h.slug} host={h} />
            ))}
          </div>
        </Container>
      </section>

      {/* ---------------- For churches ---------------- */}
      <section className="mt-28" aria-label="For churches">
        <Container>
          <div className="relative grid overflow-hidden rounded-[28px] border border-line-2 bg-surface lg:grid-cols-2">
            <div className="flex flex-col gap-6 p-8 md:p-12">
              <Eyebrow>For churches &amp; ministries</Eyebrow>
              <h2 className="text-[32px] leading-[1.08] text-strong md:text-[42px]">
                Publish events, sell tickets and check people in.
              </h2>
              <p className="text-[16px] leading-relaxed text-body">
                Everything your team needs to run a great gathering, from a free Sunday RSVP to a 500-seat conference.
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  "Free RSVPs, ticket tiers, tables and donations",
                  "QR check-in from any phone",
                  "Live sales, attendee lists and payouts",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[15px] text-ink">
                    <span className="flex size-6 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Check size={13} weight="bold" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 pt-2">
                <ButtonLink href="/for-hosts" size="lg">
                  Become a host <ArrowRight size={17} />
                </ButtonLink>
                <ButtonLink href="/for-hosts#features" variant="outline" size="lg">
                  See features
                </ButtonLink>
              </div>
            </div>
            <div className="relative flex items-center justify-center bg-raised p-8 md:p-12">
              <SalesPreview />
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- App ---------------- */}
      <section className="mt-28" aria-label="Get the app">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 flex flex-col gap-6 lg:order-1">
              <Eyebrow>The Ekklesia app</Eyebrow>
              <h2 className="text-[32px] leading-[1.08] text-strong md:text-[42px]">Your tickets, in your pocket.</h2>
              <p className="max-w-lg text-[16px] leading-relaxed text-body">
                Save events, get reminders before doors open and show your QR ticket at the door — even when signal is
                patchy.
              </p>
              <StoreBadges />
            </div>
            <div className="order-1 lg:order-2">
              <PhoneDiscover />
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="mt-28 scroll-mt-24" aria-label="Frequently asked questions">
        <Container className="grid items-start gap-10 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeader eyebrow="FAQ" title="Questions, answered" />
          <div className="flex flex-col">
            {faqs.map((f) => (
              <details key={f.q} className="group border-b border-line py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[18px] text-strong">
                  {f.q}
                  <Plus size={18} className="flex-none text-accent transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-body">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

function SalesPreview() {
  const bars = [34, 52, 41, 68, 59, 84, 72];
  return (
    <div className="w-full max-w-[420px] rounded-[20px] border border-line-2 bg-surface p-6 shadow-card" aria-hidden="true">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[10px] text-faint">Leaders Summit 2027</span>
        <span className="rounded-full border border-line-3 px-2.5 py-0.5 text-[11px] text-accent">Live</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {[
          ["Sold", "268"],
          ["Revenue", "£8,940"],
          ["Checked in", "0"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <span className="eyebrow text-[9px] text-faint">{k}</span>
            <span className="text-[22px] text-strong">{v}</span>
          </div>
        ))}
      </div>
      <div className="rule-x my-5" />
      <div className="flex h-28 items-end gap-2.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${h}%`,
              background:
                i === bars.length - 2 ? "var(--accent)" : "linear-gradient(180deg, rgb(var(--accent-rgb)/0.45), rgb(var(--accent-rgb)/0.12))",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-faint">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-3">
        <MapPin size={16} className="text-accent" />
        <span className="text-[13px] text-ink-2">Emmanuel Centre · 6 Feb</span>
      </div>
    </div>
  );
}

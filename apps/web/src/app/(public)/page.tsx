import Link from 'next/link';
import { Suspense } from 'react';
import { searchEvents } from '@/lib/api';
import { CATEGORIES, categoryOf } from '@/lib/categories';
import { fmtDay, fmtTime } from '@/lib/format';
import type { EventCardData } from '@/lib/types';
import { eventHref } from '@/lib/url';
import { SaveButton } from '@/components/client';
import { Cover } from '@/components/cover';
import { EventCard } from '@/components/event-card';
import { Faq } from '@/components/faq';
import { Icon } from '@/components/icons';
import { StoreBadges } from '@/components/site-footer';
import { EmptyState, Eyebrow, SectionHeader } from '@/components/ui';

export const revalidate = 60;

const HOME_CATEGORIES = ['worship', 'conference', 'youth', 'outreach', 'class', 'prayer', 'fundraiser', 'social'];

const FAQ = [
  {
    q: 'Do I need an account to browse events?',
    a: 'No. Anyone can browse every event and host. You only need to sign in when you RSVP, so we can keep your tickets safe in one place.',
  },
  {
    q: 'How do tickets work on the day?',
    a: 'Each place you reserve comes with a QR ticket in the app and under Your tickets, and we email you the ticket code. The host scans it at the door — one scan per ticket.',
  },
  {
    q: 'Can my church list its events?',
    a: (
      <>
        Yes. Churches, ministries and faith-based community groups can set up a host page in a few minutes and
        start publishing events straight away. See{' '}
        <Link href="/for-churches" className="text-accent">
          For churches
        </Link>{' '}
        for what’s included.
      </>
    ),
  },
  // TODO(confirm #9): the design's fourth question, "Where is Ekklesia
  // available?" (London and the UK, with Ireland and the US, local
  // currency), waits on the launch markets being confirmed.
  {
    q: 'What if I can’t make it?',
    a: 'Open the ticket and choose “Cancel my place”. Your place goes back to the host so someone else can come.',
  },
];

export default async function HomePage() {
  const soon = await searchEvents({ limit: 6 }).catch(() => null);
  const events = soon?.items ?? [];

  return (
    <>
      <Hero feature={events[0]} stub={events[1]} />

      <section className="wrap" aria-labelledby="soon">
        <SectionHeader
          id="soon"
          eyebrow="This month"
          title="Happening soon"
          action={
            <Link href="/events" className="btn btn-outline">
              See all events <Icon name="arrowRight" size={16} />
            </Link>
          }
        />
        {soon === null ? (
          <EmptyState
            icon="alert"
            title="Events couldn’t be loaded"
            body="We couldn’t reach the events service just now. Try again in a moment."
            action={
              <Link href="/events" className="btn btn-primary">
                Try again
              </Link>
            }
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing on just yet"
            body="Once churches publish their next gatherings, they’ll show up here."
            action={
              <Link href="/for-churches" className="btn btn-primary">
                Host an event
              </Link>
            }
          />
        ) : (
          <div className="cards">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>

      <section className="wrap mt-28" aria-labelledby="browse">
        <SectionHeader id="browse" eyebrow="Browse" title="Find your kind of gathering" />
        {/* TODO(confirm): the design shows an event count on each tile; the
            API has no per-category count, so it's left off. */}
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {HOME_CATEGORIES.map((v) => {
            const c = CATEGORIES.find((x) => x.value === v)!;
            return (
              <li key={v}>
                <Link href={`/events?category=${v}` as never} className="card card-link flex h-full flex-col gap-6 p-6">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-line-2 bg-softer text-accent">
                    <Icon name={c.icon} size={24} />
                  </span>
                  <span className="text-[19px] text-strong">{c.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wrap mt-28" aria-labelledby="how">
        <div className="rounded-hero border border-line bg-raised px-6 py-12 sm:px-12 sm:py-16">
          <div className="mb-10 flex flex-col gap-3">
            <Eyebrow>How it works</Eyebrow>
            <h2 id="how" className="h2 max-w-[720px]">
              From discovering to the door in three taps
            </h2>
          </div>
          <ol className="grid gap-8 md:grid-cols-[1fr_1px_1fr_1px_1fr]">
            {[
              ['01', 'Discover', 'Browse events from churches and ministries near you — no account needed.'],
              // TODO(confirm #3): the design's step is "RSVP or book" (tickets,
              // tiers, tables, gifts). Paid booking isn't live, so it says RSVP.
              ['02', 'RSVP', 'Reserve a place for yourself and the people coming with you, in seconds.'],
              ['03', 'Show your QR', 'Your ticket lives in the app and your inbox. The host scans it at the door.'],
            ].flatMap(([n, t, b], i) => [
              ...(i > 0 ? [<li key={`r${i}`} aria-hidden="true" className="rule-y hidden md:block" />] : []),
              <li key={n} className="flex flex-col gap-4">
                <span className="font-mono text-[13px] text-accent">{n}</span>
                <h3 className="text-[22px] text-strong">{t}</h3>
                <p className="text-[15px] leading-[1.65] text-body">{b}</p>
              </li>,
            ])}
          </ol>
        </div>
      </section>

      <section className="wrap mt-28" aria-labelledby="churches">
        <div className="grid overflow-hidden rounded-hero border border-line-2 bg-surface md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6 p-8 sm:p-12">
            <Eyebrow>For churches &amp; ministries</Eyebrow>
            {/* TODO(confirm #3): the design says "sell tickets" and lists
                ticket tiers, tables, donations and payouts. Paid features
                aren't live, so the copy covers what hosts can do today. */}
            <h2 id="churches" className="h2">
              Publish events, take RSVPs and check people in.
            </h2>
            <p className="text-[16px] leading-[1.65] text-body">
              Everything your team needs to run a great gathering, from a free Sunday RSVP to a 500-seat conference.
            </p>
            <ul className="flex flex-col gap-3">
              {['Free RSVPs with a QR ticket for every place', 'QR check-in from any phone', 'Live attendee lists and announcements'].map(
                (x) => (
                  <li key={x} className="flex items-center gap-3 text-[15px] text-ink">
                    <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-soft text-accent">
                      <Icon name="check" size={13} />
                    </span>
                    {x}
                  </li>
                ),
              )}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={'/organizer/organizations/new' as never} className="btn btn-primary btn-lg">
                Become a host <Icon name="arrowRight" size={17} />
              </Link>
              <Link href="/for-churches#features" className="btn btn-outline btn-lg">
                See features
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center bg-raised p-8 sm:p-12">
            <DashboardMock />
          </div>
        </div>
      </section>

      <section className="wrap mt-28 grid items-center gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-16" aria-labelledby="app">
        <div className="flex flex-col gap-6">
          <Eyebrow>The Ekklesia app</Eyebrow>
          <h2 id="app" className="h2">
            Your tickets, in your pocket.
          </h2>
          <p className="max-w-[500px] text-[16px] leading-[1.65] text-body">
            Save events, get reminders before doors open and show your QR ticket at the door — even when signal is
            patchy.
          </p>
          <StoreBadges size="lg" />
        </div>
        <div className="flex justify-center">
          <PhoneMock />
        </div>
      </section>

      <section id="faq" className="wrap mt-28" aria-labelledby="faq-title">
        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="flex flex-col gap-3">
            <Eyebrow>FAQ</Eyebrow>
            <h2 id="faq-title" className="h2">
              Questions, answered
            </h2>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>
    </>
  );
}

function Hero({ feature, stub }: { feature?: EventCardData; stub?: EventCardData }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-160px] top-[-160px] h-[720px] w-[720px] rounded-full blur-[40px]"
        style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.18), transparent 65%)' }}
      />
      <div className="wrap relative grid items-center gap-10 pb-28 pt-16 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-16">
        <div className="flex flex-col gap-7">
          {/* TODO(confirm #9): the design's eyebrow adds " · London". */}
          <Eyebrow>Church &amp; community events</Eyebrow>
          <h1 className="display">
            Gatherings worth <span className="text-accent">showing up</span> for.
          </h1>
          <p className="lead max-w-[560px]">
            Worship nights, conferences, courses and outreach from churches near you. RSVP in seconds and keep every
            ticket in one place.
          </p>
          <form action="/events" method="get" role="search" className="flex max-w-[580px] flex-col gap-3 sm:flex-row">
            <label className="field sm:flex-1">
              <Icon name="search" className="flex-none text-muted" />
              <span className="sr-only">Search events</span>
              <input type="search" name="q" placeholder="Search for events" />
            </label>
            <button type="submit" className="btn btn-primary btn-lg">
              Find events <Icon name="arrowRight" size={17} />
            </button>
          </form>
          <ul className="flex flex-wrap gap-2" aria-label="Popular categories">
            {['worship', 'conference', 'youth', 'outreach', 'class'].map((v) => (
              <li key={v}>
                <Link href={`/events?category=${v}` as never} className="chip">
                  {CATEGORIES.find((c) => c.value === v)!.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {feature ? (
          <div className="relative">
            <FeatureCard event={feature} />
            {stub && <TicketStub event={stub} />}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The hero's photo card: title and when/where over a scrim. */
function FeatureCard({ event }: { event: EventCardData }) {
  return (
    <article className="relative min-h-[440px] overflow-hidden rounded-card border border-line bg-surface-2">
      <div className="absolute inset-0">
        <Cover image={event.coverImageUrl} category={event.category} title={event.title} />
      </div>
      <div className="scrim-card" />
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between">
        <span className="tag-solid">{categoryOf(event.category).label}</span>
        <span className="pointer-events-auto relative z-10">
          <Suspense fallback={null}>
            <SaveButton eventId={event.id} title={event.title} />
          </Suspense>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6">
        <Link
          href={eventHref(event) as never}
          className="text-[34px] leading-[1.05] text-strong after:absolute after:inset-0"
        >
          {event.title}
        </Link>
        {/* TODO(confirm): the design ends with the venue name; event cards
            from the API carry only the city. */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[14px] text-ink-2">
          <span>{fmtDay(event.startsAt, event.timezone)}</span>
          <span className="dot" aria-hidden="true" />
          <span>{fmtTime(event.startsAt, event.timezone)}</span>
          {(event.venue || event.isOnline) && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>{event.venue ? event.venue.city : 'Online'}</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Decorative "next up" ticket beside the hero card. The home page is public
 * and cached, so it can't show a visitor's real ticket.
 * TODO(confirm): a signed-in visitor's own next ticket could go here.
 */
function TicketStub({ event }: { event: EventCardData }) {
  return (
    <div
      aria-hidden="true"
      className="absolute right-[-32px] top-24 hidden w-[280px] rounded-card border border-line-2 bg-surface p-5 shadow-panel sm:block"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="eyebrow text-[10px] text-faint">Next up</span>
          <span className="text-[17px] leading-[1.2] text-strong">{event.title}</span>
          <span className="text-[13px] text-ink-2">
            {fmtDay(event.startsAt, event.timezone)} · {fmtTime(event.startsAt, event.timezone)}
          </span>
        </div>
        <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-soft text-accent">
          <Icon name="qr" size={26} />
        </span>
      </div>
      <div className="rule-x my-4" />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[12px] tracking-[0.14em] text-ink-2">EK-SAMPLE</span>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Valid
        </span>
      </div>
    </div>
  );
}

/** A sample host dashboard — decorative. */
function DashboardMock() {
  const bars = [34, 52, 41, 68, 59, 84, 72];
  return (
    <div aria-hidden="true" className="w-full max-w-[420px] rounded-card border border-line-2 bg-surface p-6 shadow-panel">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[10px] text-faint">Sunday Lunch &amp; Welcome</span>
        <span className="rounded-full border border-line-3 px-2.5 py-0.5 text-[11px] text-accent">Live</span>
      </div>
      {/* TODO(confirm #3): the design shows Sold / Revenue / Checked in. */}
      <div className="mt-5 grid grid-cols-3 gap-4">
        {[
          ['Booked', '86'],
          ['Checked in', '41'],
          ['Spots left', '14'],
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
                i === 5
                  ? 'var(--accent)'
                  : 'linear-gradient(180deg, rgba(var(--accent-rgb), .45), rgba(var(--accent-rgb), .12))',
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex text-[11px] text-faint">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The mobile app's home screen — decorative. The device is always dark, in
 * either theme, so its colours are the dark theme's values on purpose.
 */
function PhoneMock() {
  return (
    <div
      aria-hidden="true"
      className="relative h-[620px] w-[300px] overflow-hidden rounded-[44px] border-[6px] border-[#241618] bg-[#0d0a0b] text-[#f2f0ef] shadow-panel"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/alpha-course.jpg" alt="" className="absolute inset-x-0 top-0 h-[300px] w-full object-cover" />
      <div
        className="absolute inset-x-0 top-0 h-[300px]"
        style={{ background: 'linear-gradient(180deg, rgba(13,10,11,.72) 0%, rgba(13,10,11,.18) 34%, rgba(13,10,11,.97) 100%)' }}
      />
      <div className="relative flex h-full flex-col px-4 pb-4 pt-3">
        <div className="flex justify-between text-[11px]">
          <span>9:41</span>
          <span className="tracking-[.1em] text-[#c9bfc2]">▮▮▮</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full border border-[rgba(249,142,128,.3)] bg-[rgba(13,10,11,.6)] px-3 py-1.5 text-[11px]">
            All locations
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(249,142,128,.4)] text-[11px] text-[#f98e80]">
            M
          </span>
        </div>
        <div className="mt-[118px] flex flex-col items-start gap-2">
          <span className="rounded-full border border-[rgba(249,142,128,.45)] px-2 py-0.5 text-[8px] uppercase tracking-[.2em] text-[#f98e80]">
            Class
          </span>
          <span className="text-[26px] leading-none text-[#f7f5f4]">Alpha Course</span>
          <span className="text-[11px] text-[#c3b8ba]">Grace Community · 16 going</span>
        </div>
        <div className="mt-4 rounded-full border border-[rgba(249,142,128,.15)] bg-[#1b1517] px-3.5 py-2.5 text-[12px] text-[#8b8083]">
          Search for events
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-[15px]">Happening soon</span>
          <span className="text-[11px] text-[#f98e80]">See all</span>
        </div>
        <div className="relative mt-2.5 h-[132px] overflow-hidden rounded-2xl bg-[#1b1517]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/city-outreach.jpg" alt="" className="h-full w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(13,10,11,.4) 0%, transparent 40%, rgba(13,10,11,.92) 100%)' }}
          />
          <span className="absolute bottom-3 left-3 text-[15px] text-[#f7f5f4]">City Outreach Day</span>
        </div>
        <div className="mt-auto flex items-center gap-1 rounded-full border border-[rgba(249,142,128,.15)] bg-[#1b1517] p-1.5">
          <span className="rounded-full border border-[rgba(249,142,128,.5)] bg-[rgba(249,142,128,.15)] px-3 py-1.5 text-[11px] text-[#f98e80]">
            Discover
          </span>
          <span className="flex flex-1 justify-around text-[11px] text-[#8b8083]">
            <span>Hosts</span>
            <span>Tickets</span>
            <span>Saved</span>
          </span>
        </div>
      </div>
    </div>
  );
}

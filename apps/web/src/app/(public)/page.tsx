import Link from 'next/link';
import { searchEvents } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { fmtDay, fmtTime } from '@/lib/format';
import type { EventCardData } from '@/lib/types';
import { eventHref } from '@/lib/url';
import { Cover } from '@/components/cover';
import { EventCard, EventFeatureCard } from '@/components/event-card';
import { Faq } from '@/components/faq';
import { Icon } from '@/components/icons';
import { StoreBadges } from '@/components/site-footer';
import { EmptyState, Eyebrow, SectionHeader } from '@/components/ui';

export const revalidate = 60;

const HOME_CATEGORIES = ['worship', 'conference', 'youth', 'outreach', 'class', 'prayer', 'fundraiser', 'social'];

const FAQ = [
  {
    q: 'Do I need an account to browse?',
    a: 'No. Anyone can browse events and host pages. You only sign in to RSVP, save events or see your tickets.',
  },
  {
    q: 'How do I get my ticket?',
    a: 'As soon as you RSVP, your ticket appears under Your tickets with a QR code, and we email you a confirmation. Show the code at the door and the host scans it.',
  },
  {
    q: 'Can I bring someone with me?',
    a: 'Yes. Choose how many places you need when you RSVP (up to ten, while places last). Each place gets its own ticket.',
  },
  {
    q: 'What if I can’t make it?',
    a: 'Open the ticket and choose “Cancel my place”. Your place goes back to the host so someone else can come.',
  },
  {
    q: 'I run events for a church. How do I start?',
    a: (
      <>
        Create a host page — it takes a few minutes. See{' '}
        <Link href="/for-churches" className="text-accent">
          For churches
        </Link>{' '}
        for what’s included.
      </>
    ),
  },
];

export default async function HomePage() {
  const soon = await searchEvents({ limit: 7 }).catch(() => null);
  const events = soon?.items ?? [];
  const [next, ...rest] = events;

  return (
    <>
      <Hero next={next} />

      <section className="wrap pt-24" aria-labelledby="soon">
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
          <div className="grid gap-6 lg:grid-cols-2">
            {rest.length > 0 && rest[0] && <EventFeatureCard event={rest[0]} tall />}
            <div className="cards !grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {(rest.length > 0 ? rest.slice(1, 5) : events).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="wrap pt-24" aria-labelledby="browse">
        <SectionHeader id="browse" eyebrow="Browse" title="Find your kind of gathering" />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {HOME_CATEGORIES.map((v) => {
            const c = CATEGORIES.find((x) => x.value === v)!;
            return (
              <li key={v}>
                <Link
                  href={`/events?category=${v}` as never}
                  className="card card-link flex h-full flex-col gap-6 p-6"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-2 text-accent">
                    <Icon name={c.icon} size={22} />
                  </span>
                  <span className="flex items-center justify-between text-[18px] text-strong">
                    {c.label} <Icon name="arrowRight" size={16} className="text-accent" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wrap pt-24" aria-labelledby="how">
        <SectionHeader id="how" eyebrow="How it works" title="From discovering to the door in three taps" />
        <ol className="grid gap-8 md:grid-cols-[1fr_1px_1fr_1px_1fr]">
          {[
            ['01', 'Discover', 'Browse events from churches and ministries near you — no account needed.'],
            ['02', 'RSVP', 'Reserve a place for yourself and the people coming with you, in seconds.'],
            ['03', 'Show your QR', 'Your ticket lives in the app and your inbox. The host scans it at the door.'],
          ].flatMap(([n, t, b], i) => [
            ...(i > 0 ? [<li key={`r${i}`} aria-hidden="true" className="rule-y hidden md:block" />] : []),
            <li key={n} className="flex flex-col gap-3">
              <span className="font-mono text-[14px] text-accent">{n}</span>
              <h3 className="text-[24px] text-strong">{t}</h3>
              <p className="text-[15px] leading-relaxed text-body">{b}</p>
            </li>,
          ])}
        </ol>
      </section>

      <section className="wrap pt-24">
        <div className="relative overflow-hidden rounded-hero border border-line-2 bg-surface p-8 sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.16), transparent 65%)' }}
          />
          <div className="relative grid items-center gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-5">
              <Eyebrow>For churches &amp; ministries</Eyebrow>
              <h2 className="h2">Publish events, take RSVPs and check people in.</h2>
              <p className="lead">
                Everything your team needs to run a great gathering, from a Sunday lunch RSVP to a
                500-seat conference.
              </p>
              <ul className="flex flex-col gap-3 text-[15px] text-ink-2">
                {['Free RSVPs with a QR ticket for every place', 'QR check-in from any phone', 'Live attendee lists and announcements'].map(
                  (x) => (
                    <li key={x} className="flex items-center gap-3">
                      <Icon name="check" size={16} className="text-accent" /> {x}
                    </li>
                  ),
                )}
              </ul>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href={'/organizer/organizations/new' as never} className="btn btn-primary btn-lg">
                  Become a host
                </Link>
                <Link href="/for-churches#features" className="btn btn-outline btn-lg">
                  See features
                </Link>
              </div>
            </div>
            <div className="card flex flex-col gap-5 p-6" aria-hidden="true">
              <div className="flex items-center justify-between">
                <span className="text-[17px] text-strong">Sunday Lunch &amp; Welcome</span>
                <span className="tag">Live</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['Booked', '86'],
                  ['Checked in', '41'],
                  ['Spots left', '14'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-line bg-raised p-4">
                    <span className="eyebrow text-[10px] text-faint">{k}</span>
                    <p className="mt-2 text-[26px] text-strong">{v}</p>
                  </div>
                ))}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-[48%] rounded-full bg-accent" />
              </div>
              <span className="text-[13px] text-faint">Sample dashboard</span>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap pt-24">
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <Eyebrow>The Ekklesia app</Eyebrow>
            <h2 className="h2">Your tickets, in your pocket.</h2>
            <p className="lead">
              Save events, get reminders before doors open and show your QR ticket at the door —
              even when signal is patchy.
            </p>
            <StoreBadges />
          </div>
          {next ? <PhoneTicket event={next} /> : null}
        </div>
      </section>

      <section id="faq" className="wrap pt-24" aria-labelledby="faq-title">
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

function Hero({ next }: { next?: EventCardData }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-200px] top-[-260px] h-[760px] w-[760px] rounded-full blur-[30px]"
        style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.14), transparent 65%)' }}
      />
      <div className="wrap relative grid items-center gap-14 pb-8 pt-16 sm:pt-24 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Eyebrow>Church &amp; community events</Eyebrow>
          <h1 className="display">Gatherings worth showing up for.</h1>
          <p className="lead max-w-[520px]">
            Worship nights, conferences, courses and outreach from churches near you. RSVP in
            seconds and keep every ticket in one place.
          </p>
          <form action="/events" method="get" role="search" className="flex flex-col gap-3 sm:flex-row">
            <label className="field !border-line-2 sm:flex-1">
              <Icon name="search" className="text-accent" />
              <span className="sr-only">Search events</span>
              <input type="search" name="q" placeholder="Search for events, churches or topics" />
            </label>
            <button type="submit" className="btn btn-primary btn-lg">
              Find events
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {['worship', 'conference', 'youth', 'outreach', 'class'].map((v) => (
              <Link key={v} href={`/events?category=${v}` as never} className="chip">
                {CATEGORIES.find((c) => c.value === v)!.label}
              </Link>
            ))}
          </div>
        </div>
        {next ? (
          <Link
            href={eventHref(next) as never}
            className="group relative hidden min-h-[460px] overflow-hidden rounded-hero border border-line-2 shadow-panel md:block"
          >
            <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]">
              <Cover image={next.coverImageUrl} category={next.category} title={next.title} />
            </div>
            <div className="scrim-card" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-7">
              <span className="eyebrow text-accent">Next up</span>
              <span className="text-[32px] leading-[1.05] text-strong">{next.title}</span>
              <span className="text-[15px] text-ink-2">
                {fmtDay(next.startsAt, next.timezone)} · {fmtTime(next.startsAt, next.timezone)} ·{' '}
                {next.organization.name}
              </span>
            </div>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** A phone frame showing a ticket — decorative, built from the next real event. */
function PhoneTicket({ event }: { event: EventCardData }) {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-[320px] rounded-[44px] border border-line-2 bg-raised p-3 shadow-panel">
      <div className="flex flex-col items-center gap-4 rounded-[34px] bg-surface px-6 pb-8 pt-10 text-center">
        <span className="eyebrow text-[10px] text-ink-2">{event.organization.name}</span>
        <span className="text-[22px] leading-tight text-strong">{event.title}</span>
        <span className="text-[13px] text-muted">
          {fmtDay(event.startsAt, event.timezone)} · {fmtTime(event.startsAt, event.timezone)}
        </span>
        <div className="w-full border-t border-dashed border-line-2" />
        <div className="grid h-[150px] w-[150px] grid-cols-7 gap-[3px] rounded-2xl bg-white p-3">
          {Array.from({ length: 49 }, (_, i) => (
            <span key={i} className={((i * 7) % 5 < 2 || i % 8 === 0) ? 'bg-[#1a0f0d]' : 'bg-transparent'} />
          ))}
        </div>
        <span className="font-mono text-[13px] tracking-[0.22em] text-strong">EK-SAMPLE</span>
        <span className="flex items-center gap-2 text-[13px]">
          <span className="h-2 w-2 rounded-full bg-accent" /> Valid
        </span>
      </div>
    </div>
  );
}

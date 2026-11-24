import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq } from '@/components/faq';
import { Icon, type IconName } from '@/components/icons';
import { Eyebrow } from '@/components/ui';

export const metadata: Metadata = {
  title: 'For churches',
  description: 'Publish events, take RSVPs and check people in — with a host page your congregation can follow.',
};

const START = '/organizer/organizations/new';

const KINDS: [IconName, string, string][] = [
  ['church', 'Church', 'A congregation that meets regularly'],
  ['building', 'Ministry', 'An organisation serving a wider mission'],
  ['users', 'Community', 'A faith-based group or network'],
];

// Only what the product does today. Paid tiers, tables, donations and payouts
// are in the design but not live (docs/04 #3), so they aren't promised here.
const FEATURES: [IconName, string, string][] = [
  ['calendar', 'Create an event in minutes', 'Add a cover photo, date, venue and description — your event page is ready to share.'],
  ['ticket', 'Free RSVPs with QR tickets', 'Every place gets its own ticket and QR code, in the app and by email.'],
  ['globe', 'In person, online or both', 'Add a venue, a stream link, or both for hybrid gatherings.'],
  ['image', 'Photos and video', 'Add a gallery of photos and a video link to show people what to expect.'],
  ['scan', 'QR check-in', 'Scan tickets at the door from any phone. One scan per ticket, no duplicates.'],
  ['users', 'Attendee lists', 'See who’s coming, search by name or code, and export your list when you need it.'],
  ['megaphone', 'Announcements', 'Message everyone with a ticket — a change of room, a reminder, a thank you.'],
  ['building', 'Your host page', 'One page for your church with every upcoming event, ready to link from your site.'],
];

const FAQ = [
  {
    q: 'Does it cost anything to list free events?',
    // TODO(confirm): docs/04 #7 — "free to publish free events".
    a: 'No. Publishing free events and collecting RSVPs is free. Paid ticketing isn’t live yet; we’ll publish fees before it is.',
  },
  {
    q: 'Do we need to be verified to publish?',
    a: 'No. You can create and publish events straight away. If you add your contact details and address, we review your page so people know it’s really you.',
  },
  {
    q: 'Can several people from our team run events?',
    // TODO(confirm): docs/04 #8 — team access / roles.
    a: 'Each host page has an owner today. Team access is on the way; get in touch if you need it now.',
  },
  {
    q: 'Which countries are supported?',
    // TODO(confirm): docs/04 #9.
    a: 'Hosts in the UK, Ireland and the US can sign up today. Your country sets your default currency.',
  },
  {
    q: 'How does check-in work?',
    a: 'Open the check-in page on any phone, point the camera at a ticket’s QR code and it’s admitted. You can also type a code in, or tick people off the attendee list.',
  },
];

export default function ForChurchesPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[-160px] top-0 h-[640px] w-[640px] rounded-full blur-[40px]"
          style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.16), transparent 65%)' }}
        />
        <div className="wrap relative flex flex-col items-start gap-7 py-20">
          <Eyebrow>For churches, ministries &amp; communities</Eyebrow>
          <h1 className="display max-w-[900px]">
            Run every gathering from <span className="text-accent">one place</span>.
          </h1>
          {/* TODO(confirm #3): the design also says "sell tickets, take
              donations", and "can follow" — paid features and following
              aren't live, so the page says "can visit". */}
          <p className="lead max-w-[680px]">
            Publish events, take RSVPs and check people in at the door — with a host page your
            congregation can visit.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={START as never} className="btn btn-primary btn-lg">
              Become a host <Icon name="arrowRight" size={17} />
            </Link>
            <a href="#features" className="btn btn-outline btn-lg">
              Explore features
            </a>
          </div>
          <ul className="mt-6 grid w-full gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {KINDS.map(([icon, k, d]) => (
              <li key={k} className="card flex items-center gap-4 p-5">
                <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-soft text-accent">
                  <Icon name={icon} size={24} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[18px] text-strong">{k}</span>
                  <span className="text-[14px] text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="wrap scroll-mt-24" aria-labelledby="features-title">
        <div className="mb-10 flex flex-col gap-3">
          <Eyebrow>Features</Eyebrow>
          <h2 id="features-title" className="h2 max-w-[760px]">
            Everything from a Sunday RSVP to a sold-out conference
          </h2>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([icon, t, b]) => (
            <li key={t} className="flex flex-col gap-4 bg-surface p-7">
              <Icon name={icon} size={26} className="text-accent" />
              <h3 className="text-[18px] text-strong">{t}</h3>
              <p className="text-[14px] leading-relaxed text-body">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap mt-28 grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]" aria-labelledby="steps">
        <div className="flex flex-col gap-3">
          <Eyebrow>Getting started</Eyebrow>
          <h2 id="steps" className="h2">
            Live in three steps
          </h2>
          <p className="text-[16px] leading-[1.6] text-body">
            Set up takes a few minutes. You can save and come back at any point.
          </p>
        </div>
        <ol className="flex flex-col">
          {[
            ['01', 'Tell us who you are', 'Church, ministry or community — choose a type, your host name and page address.'],
            ['02', 'Add your details', 'Logo, location and a short description, so people know they’ve found the right place.'],
            ['03', 'Publish your first event', 'Set up RSVPs and share your link. You’re live.'],
          ].map(([n, t, b], i) => (
            <li key={n} className={`flex gap-6 border-b border-line ${i === 0 ? 'pb-7' : 'py-7'}`}>
              <span className="font-mono text-[14px] text-accent">{n}</span>
              <span className="flex flex-col gap-2">
                <h3 className="text-[22px] text-strong">{t}</h3>
                <p className="text-[15px] leading-[1.6] text-body">{b}</p>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" className="wrap mt-28 scroll-mt-24" aria-labelledby="faq-title">
        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="flex flex-col gap-3">
            <Eyebrow>Host FAQ</Eyebrow>
            <h2 id="faq-title" className="h2">
              Good questions
            </h2>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>

      <section className="wrap mt-28">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-hero border border-line-2 bg-raised p-8 sm:p-12">
          <div className="flex flex-col gap-3">
            <h2 className="text-[30px] leading-[1.15] text-strong sm:text-[38px]">Ready to fill the room?</h2>
            {/* TODO(confirm): docs/04 #7 — "free to publish free events". */}
            <p className="text-[16px] text-body">Create your host page today — it’s free to publish free events.</p>
          </div>
          <Link href={START as never} className="btn btn-primary btn-lg">
            Get started <Icon name="arrowRight" size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}

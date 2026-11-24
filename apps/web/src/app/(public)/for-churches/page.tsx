import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq } from '@/components/faq';
import { Icon, type IconName } from '@/components/icons';
import { Eyebrow, SectionHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'For churches',
  description: 'Publish events, take RSVPs and check people in — with a host page your congregation can follow.',
};

const START = '/organizer/organizations/new';

const KINDS = [
  ['Church', 'A congregation that meets regularly'],
  ['Ministry', 'An organisation serving a wider mission'],
  ['Community', 'A faith-based group or network'],
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
    q: 'What does it cost?',
    // TODO(confirm): docs/04 #7 — "free to publish free events".
    a: 'It’s free to publish free events. Paid ticketing isn’t live yet; we’ll publish fees before it is.',
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
    q: 'Which countries do you support?',
    // TODO(confirm): docs/04 #9.
    a: 'The United Kingdom, Ireland and the United States.',
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
          className="pointer-events-none absolute right-[-200px] top-[-260px] h-[760px] w-[760px] rounded-full blur-[30px]"
          style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.14), transparent 65%)' }}
        />
        <div className="wrap relative flex flex-col gap-6 pb-10 pt-16 sm:pt-24">
          <Eyebrow>For churches, ministries &amp; communities</Eyebrow>
          <h1 className="display max-w-[900px]">
            Run every gathering from <span className="text-accent">one place</span>.
          </h1>
          <p className="lead max-w-[620px]">
            Publish events, take RSVPs and check people in at the door — with a host page your
            congregation can follow.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={START as never} className="btn btn-primary btn-lg">
              Become a host
            </Link>
            <a href="#features" className="btn btn-outline btn-lg">
              Explore features
            </a>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {KINDS.map(([k, d]) => (
              <li key={k} className="card flex flex-col gap-2 p-6">
                <span className="text-[18px] text-strong">{k}</span>
                <span className="text-[14px] text-body">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="wrap scroll-mt-24 pt-20" aria-labelledby="features-title">
        <SectionHeader id="features-title" eyebrow="Features" title="Everything from a Sunday RSVP to a full conference" />
        <ul className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([icon, t, b]) => (
            <li key={t} className="flex flex-col gap-4 bg-surface p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-accent">
                <Icon name={icon} />
              </span>
              <h3 className="text-[18px] text-strong">{t}</h3>
              <p className="text-[14px] leading-relaxed text-body">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap pt-24" aria-labelledby="steps">
        <SectionHeader
          id="steps"
          eyebrow="Getting started"
          title="Live in three steps"
          intro="Set up takes a few minutes. You can save and come back at any point."
        />
        <ol className="grid gap-8 md:grid-cols-[1fr_1px_1fr_1px_1fr]">
          {[
            ['01', 'Tell us who you are', 'Church, ministry or community — choose a type, your host name and page address.'],
            ['02', 'Add your details', 'Logo, location and a short description, so people know they’ve found the right place.'],
            ['03', 'Publish your first event', 'Set up RSVPs and share your link. You’re live.'],
          ].flatMap(([n, t, b], i) => [
            ...(i > 0 ? [<li key={`r${i}`} aria-hidden="true" className="rule-y hidden md:block" />] : []),
            <li key={n} className="flex flex-col gap-3">
              <span className="font-mono text-[14px] text-accent">{n}</span>
              <h3 className="text-[22px] text-strong">{t}</h3>
              <p className="text-[15px] leading-relaxed text-body">{b}</p>
            </li>,
          ])}
        </ol>
      </section>

      <section id="faq" className="wrap scroll-mt-24 pt-24" aria-labelledby="faq-title">
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

      <section className="wrap pt-24">
        <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-hero border border-line-2 bg-surface px-6 py-16 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[-200px] h-[520px] w-[520px] -translate-x-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.16), transparent 65%)' }}
          />
          <h2 className="h2 relative">Ready to fill the room?</h2>
          <p className="lead relative">Create your host page today — it’s free to publish free events.</p>
          <Link href={START as never} className="btn btn-primary btn-lg relative">
            Get started
          </Link>
        </div>
      </section>
    </>
  );
}

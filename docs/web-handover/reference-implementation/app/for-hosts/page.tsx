import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarPlus,
  Ticket,
  HandHeart,
  Armchair,
  QrCode,
  ChartLineUp,
  Bank,
  UsersThree,
  Plus,
  Church,
  Buildings,
  UsersFour,
} from "@phosphor-icons/react/ssr";
import { ButtonLink, Container, Eyebrow, SectionHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Host events on Ekklesia",
  description:
    "Publish events, sell tickets, take donations and check people in. Built for churches, ministries and faith communities.",
};

const features = [
  { icon: CalendarPlus, t: "Create an event in minutes", d: "Add a cover photo, date, venue and description — your event page is ready to share." },
  { icon: Ticket, t: "Free RSVPs or ticket tiers", d: "Early bird, standard, group or concession tiers with their own limits." },
  { icon: Armchair, t: "Tables and seating", d: "Let guests reserve a whole table for galas, dinners and conferences." },
  { icon: HandHeart, t: "Donations at checkout", d: "Invite an optional gift with every booking, or run a donation-only event." },
  { icon: QrCode, t: "QR check-in", d: "Scan tickets at the door from any phone. One scan per ticket, no duplicates." },
  { icon: UsersThree, t: "Attendee lists", d: "See who's coming, search by name and export your list when you need it." },
  { icon: ChartLineUp, t: "Live sales dashboard", d: "Track bookings, revenue and check-ins as they happen." },
  { icon: Bank, t: "Payouts to your account", d: "Ticket income goes to your church's bank account, with clear payout summaries." },
];

const steps = [
  { t: "Tell us who you are", d: "Church, ministry or community — choose a type, your host name and page address." },
  { t: "Add your details", d: "Logo, location and a short description, so people know they've found the right place." },
  { t: "Publish your first event", d: "Set up tickets or RSVPs and share your link. You're live." },
];

const faqs = [
  { q: "Who can host on Ekklesia?", a: "Churches, ministries and faith-based community groups. We check every host page before it goes live." },
  { q: "Does it cost anything to list free events?", a: "No. Publishing free events and collecting RSVPs is free." },
  { q: "Can more than one person manage our events?", a: "Yes — invite your team so they can create events, see attendees and scan tickets at the door." },
  { q: "Which countries are supported?", a: "Hosts in the UK, Ireland and the US can sign up today. Your country sets your default currency." },
];

export default function ForHostsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-0 size-[640px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--accent-rgb) / 0.16), transparent 65%)" }}
        />
        <Container className="relative flex flex-col items-start gap-7 pb-20 pt-12 md:pt-20">
          <Eyebrow>For churches, ministries &amp; communities</Eyebrow>
          <h1 className="max-w-4xl text-[44px] leading-[1.02] tracking-[-0.02em] text-strong text-balance md:text-[68px]">
            Run every gathering from <span className="text-accent">one place</span>.
          </h1>
          <p className="max-w-2xl text-[18px] leading-relaxed text-body">
            Publish events, sell tickets, take donations and check people in at the door — with a host page your
            congregation can follow.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-in?next=/for-hosts" size="lg">
              Become a host <ArrowRight size={17} />
            </ButtonLink>
            <ButtonLink href="#features" variant="outline" size="lg">
              Explore features
            </ButtonLink>
          </div>
          <ul className="mt-6 grid w-full gap-4 sm:grid-cols-3">
            {[
              { icon: Church, t: "Church", d: "A congregation that meets regularly" },
              { icon: Buildings, t: "Ministry", d: "An organisation serving a wider mission" },
              { icon: UsersFour, t: "Community", d: "A faith-based group or network" },
            ].map((k) => (
              <li key={k.t} className="flex items-center gap-4 rounded-[20px] border border-line bg-surface p-5">
                <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <k.icon size={24} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[18px] text-strong">{k.t}</span>
                  <span className="text-[14px] text-muted">{k.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="features" className="scroll-mt-24" aria-label="Features">
        <Container>
          <SectionHeader eyebrow="Features" title="Everything from a Sunday RSVP to a sold-out conference" />
          <ul className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <li key={f.t} className="flex flex-col gap-4 bg-surface p-6 md:p-7">
                <f.icon size={26} className="text-accent" />
                <span className="text-[18px] leading-snug text-strong">{f.t}</span>
                <span className="text-[14px] leading-relaxed text-body">{f.d}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="mt-28" aria-label="Getting started">
        <Container className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeader eyebrow="Getting started" title="Live in three steps" intro="Set up takes a few minutes. You can save and come back at any point." />
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-6 border-b border-line py-7 first:pt-0">
                <span className="font-mono text-[14px] text-accent">0{i + 1}</span>
                <span className="flex flex-col gap-2">
                  <span className="text-[22px] text-strong">{s.t}</span>
                  <span className="text-[15px] leading-relaxed text-body">{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="faq" className="mt-28 scroll-mt-24" aria-label="Host FAQ">
        <Container className="grid items-start gap-10 lg:grid-cols-[1fr_1.5fr]">
          <SectionHeader eyebrow="Host FAQ" title="Good questions" />
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

      <section className="mt-28">
        <Container>
          <div className="flex flex-col items-start gap-6 rounded-[28px] border border-line-2 bg-raised p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div className="flex flex-col gap-3">
              <h2 className="text-[30px] leading-tight text-strong md:text-[38px]">Ready to fill the room?</h2>
              <p className="text-[16px] text-body">Create your host page today — it&apos;s free to publish free events.</p>
            </div>
            <ButtonLink href="/sign-in?next=/for-hosts" size="lg">
              Get started <ArrowRight size={17} />
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}

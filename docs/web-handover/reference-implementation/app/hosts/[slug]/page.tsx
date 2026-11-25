import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, CalendarBlank, Users, Plus } from "@phosphor-icons/react/ssr";
import { eventsByHost, getHost, hosts } from "@/lib/data";
import { EventCard } from "@/components/event-card";
import { HostAvatar } from "@/components/host-card";
import { ButtonLink, Container, Tag } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return hosts.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = getHost((await params).slug);
  return h ? { title: h.name, description: h.bio } : {};
}

export default async function HostPage({ params }: Props) {
  const host = getHost((await params).slug);
  if (!host) notFound();
  const list = eventsByHost(host.slug).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 120% at 90% 0%, rgb(var(--accent-rgb) / 0.18), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgb(var(--accent-rgb) / 0.08), transparent 60%)",
          }}
        />
        <Container className="relative flex flex-col gap-8 pb-12 pt-8 md:pb-16 md:pt-12">
          <Link href="/hosts" className="inline-flex items-center gap-2 self-start text-[14px] text-ink-2 hover:text-accent">
            <ArrowLeft size={15} /> All hosts
          </Link>
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <HostAvatar host={host} size={104} />
              <div className="flex flex-col gap-3">
                <Tag>{host.type}</Tag>
                <h1 className="text-[38px] leading-[1.05] text-strong md:text-[52px]">{host.name}</h1>
                <p className="flex items-center gap-2 text-[15px] text-ink-2">
                  <MapPin size={16} className="text-accent" /> {host.area}, {host.city}
                </p>
              </div>
            </div>
            <ButtonLink href={`/sign-in?next=/hosts/${host.slug}`} size="lg">
              <Plus size={17} /> Follow
            </ButtonLink>
          </div>
          <p className="max-w-2xl text-[17px] leading-[1.7] text-body">{host.bio}</p>
          <dl className="flex flex-wrap gap-x-12 gap-y-4">
            {[
              { icon: CalendarBlank, k: "Upcoming events", v: list.length },
              { icon: Users, k: "Followers", v: host.followers.toLocaleString("en-GB") },
              { icon: MapPin, k: "On Ekklesia since", v: host.since },
            ].map((s) => (
              <div key={s.k} className="flex flex-col gap-1">
                <dt className="eyebrow flex items-center gap-2 text-[10px] text-faint">
                  <s.icon size={13} className="text-accent" /> {s.k}
                </dt>
                <dd className="text-[24px] text-strong">{s.v}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <Container className="pt-14">
        <h2 className="mb-8 text-[30px] text-strong">Upcoming events</h2>
        {list.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => (
              <EventCard key={e.slug} event={e} />
            ))}
          </div>
        ) : (
          <p className="rounded-[20px] border border-line bg-surface p-10 text-center text-body">
            No upcoming events yet — follow {host.name} to hear when they publish one.
          </p>
        )}
      </Container>
    </>
  );
}

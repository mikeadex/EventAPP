import Link from "next/link";
import { MapPin, ArrowUpRight } from "@phosphor-icons/react/ssr";
import type { Host } from "@/lib/data";
import { eventsByHost } from "@/lib/data";
import { Dot } from "./ui";

export function HostAvatar({ host, size = 56 }: { host: Host; size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full border border-line-3 bg-avatar text-accent"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {host.initials}
    </span>
  );
}

export function HostCard({ host }: { host: Host }) {
  const upcoming = eventsByHost(host.slug).length;
  return (
    <article className="group relative flex flex-col gap-5 rounded-[20px] border border-line bg-surface p-6 transition-colors hover:border-line-2">
      <div className="flex items-start justify-between gap-4">
        <HostAvatar host={host} />
        <ArrowUpRight size={20} className="text-faint transition-colors group-hover:text-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-[10px] text-accent">{host.type}</span>
        <h3 className="text-[21px] leading-tight text-strong">
          <Link href={`/hosts/${host.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {host.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[15px] leading-relaxed text-body">{host.bio}</p>
      </div>
      <div className="mt-auto flex items-center gap-3 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} className="text-accent" /> {host.area}
        </span>
        <Dot />
        <span>
          {upcoming} upcoming {upcoming === 1 ? "event" : "events"}
        </span>
      </div>
    </article>
  );
}

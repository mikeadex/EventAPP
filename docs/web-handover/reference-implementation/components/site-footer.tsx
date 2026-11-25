import Link from "next/link";
import { Logo } from "./brand";
import { StoreBadges } from "./store-badges";

const cols = [
  {
    title: "Discover",
    links: [
      { href: "/events", label: "All events" },
      { href: "/events?category=Worship", label: "Worship" },
      { href: "/events?category=Conference", label: "Conferences" },
      { href: "/hosts", label: "Browse hosts" },
    ],
  },
  {
    title: "Hosts",
    links: [
      { href: "/for-hosts", label: "Host on Ekklesia" },
      { href: "/for-hosts#features", label: "Features" },
      { href: "/for-hosts#faq", label: "Host FAQ" },
      { href: "/sign-in", label: "Host sign in" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/#faq", label: "FAQ" },
      { href: "mailto:david@ekklesiaevents.com", label: "Support" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-raised">
      <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.3fr_2fr]">
        <div className="flex flex-col gap-6">
          <Logo />
          <p className="max-w-sm text-[15px] leading-relaxed text-body">
            The home for church and faith-community events. Find what&apos;s on near you, RSVP in seconds and keep your
            tickets in one place.
          </p>
          <StoreBadges />
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {cols.map((c) => (
            <div key={c.title} className="flex flex-col gap-4">
              <h2 className="eyebrow text-faint">{c.title}</h2>
              <ul className="flex flex-col gap-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[15px] text-ink-2 transition-colors hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="rule-x mx-auto max-w-[1240px]" />
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2 px-5 py-6 text-[13px] text-faint sm:flex-row sm:justify-between sm:px-8">
        <span>© {new Date().getFullYear()} Ekklesia Events · London, UK</span>
        <span>Made for churches, ministries and faith communities.</span>
      </div>
    </footer>
  );
}

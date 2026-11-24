import Link from 'next/link';
import { Logo } from './brand';

// TODO(confirm): App Store / Google Play listing URLs (docs/04 #11).
export const APP_STORE_URL = '#';
export const PLAY_STORE_URL = '#';

const COLS = [
  {
    title: 'Discover',
    links: [
      { href: '/events', label: 'All events' },
      { href: '/events?category=worship', label: 'Worship' },
      { href: '/events?category=conference', label: 'Conferences' },
      // TODO(confirm): the design has "Browse hosts" here, once /hosts exists.
      { href: '/events?price=free', label: 'Free events' },
    ],
  },
  {
    title: 'Hosts',
    links: [
      { href: '/for-churches', label: 'Host on Ekklesia' },
      { href: '/for-churches#features', label: 'Features' },
      { href: '/for-churches#faq', label: 'Host FAQ' },
      { href: '/sign-in?next=/organizer', label: 'Host sign in' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/#faq', label: 'FAQ' },
      { href: '/support', label: 'Support' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

/** `lg` is the home page's app band: 52px tall, 16px label. */
export function StoreBadges({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex flex-wrap gap-3">
      {[
        { href: APP_STORE_URL, small: 'Download on the', big: 'App Store' },
        { href: PLAY_STORE_URL, small: 'Get it on', big: 'Google Play' },
      ].map((b) => (
        <a
          key={b.big}
          href={b.href}
          className={`inline-flex flex-col justify-center rounded-xl border border-line-2 bg-surface leading-[1.1] transition-colors hover:border-line-3 ${size === 'lg' ? 'h-[52px] px-[18px]' : 'h-12 px-4'}`}
        >
          <span className="text-[10px] text-faint">{b.small}</span>
          <span className={size === 'lg' ? 'text-[16px]' : 'text-[15px]'}>{b.big}</span>
        </a>
      ))}
    </div>
  );
}

/**
 * Also what makes the legal and support pages reachable: both stores require
 * a reachable privacy policy and support page.
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-raised">
      <div className="wrap grid items-start gap-12 py-16 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Logo />
          <p className="max-w-[380px] text-[15px] leading-relaxed text-body">
            The home for church and faith-community events. Find what&rsquo;s on near you, RSVP in
            seconds and keep your tickets in one place.
          </p>
          <StoreBadges />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-10">
          {COLS.map((c) => (
            <div key={c.title} className="flex flex-col gap-4">
              <h2 className="eyebrow text-faint">{c.title}</h2>
              <ul className="flex flex-col gap-3 text-[15px] text-ink-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href as never} className="transition-colors hover:text-accent">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="wrap">
        <div className="rule-x" />
      </div>
      <div className="wrap flex flex-wrap justify-between gap-2 py-6 text-[13px] text-faint">
        <span>© {new Date().getFullYear()} Ekklesia Events · London, UK</span>
        <span>Made for churches, ministries and faith communities.</span>
      </div>
    </footer>
  );
}

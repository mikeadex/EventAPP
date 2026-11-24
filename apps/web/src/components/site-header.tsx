'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { useMe } from '@/lib/use-api';
import { initials } from '@/lib/format';
import { Logo } from './brand';
import { ThemeToggle } from './client';
import { Icon } from './icons';

// TODO(confirm): the design's nav also has "Hosts"; it needs a hosts
// directory (an org-list endpoint and a /hosts page), which don't exist yet.
const NAV = [
  { href: '/events', label: 'Discover' },
  { href: '/for-churches', label: 'For churches' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const user = session?.user;
  // Only people who belong to a host page get the dashboard shortcut.
  const me = useMe(!!user);
  const isHost = me.status === 'ready' && me.data.memberships.length > 0;

  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const signInHref = `/sign-in?next=${encodeURIComponent(pathname)}`;

  const mobileNav = [
    ...NAV,
    ...(user
      ? [
          { href: '/me/tickets', label: 'Your tickets' },
          { href: '/saved', label: 'Saved' },
          ...(isHost ? [{ href: '/organizer', label: 'Host dashboard' }] : []),
          { href: '/account', label: 'Account' },
        ]
      : [
          { href: '/saved', label: 'Saved' },
          { href: signInHref, label: 'Sign in' },
        ]),
  ];

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header
        className="sticky top-0 z-50 border-b border-line"
        style={{
          background: 'rgba(var(--scrim), 0.86)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="wrap flex h-[72px] items-center justify-between gap-6">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href as never}
                aria-current={active(n.href) ? 'page' : undefined}
                className={`rounded-full px-4 py-2 text-[15px] transition-colors ${
                  active(n.href) ? 'bg-soft text-accent [[data-theme=light]_&]:text-accent-ink' : 'text-ink-2 hover:text-accent'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/saved" aria-label="Saved events" className="icon-btn hidden sm:inline-flex">
              <Icon name="heart" />
            </Link>
            {isPending ? (
              <span className="hidden h-9 w-24 sm:block" aria-hidden="true" />
            ) : user ? (
              <>
                <Link href={'/me/tickets' as never} aria-label="Your tickets" className="icon-btn hidden sm:inline-flex">
                  <Icon name="ticket" />
                </Link>
                {isHost && (
                  <Link href={'/organizer' as never} className="btn btn-outline btn-sm hidden sm:inline-flex">
                    Host dashboard
                  </Link>
                )}
                <Link
                  href={'/account' as never}
                  aria-label="Your account"
                  className="hidden h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-line-3 bg-avatar text-[15px] text-accent sm:inline-flex [[data-theme=light]_&]:text-accent-ink"
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(user.name || user.email).slice(0, 1)
                  )}
                </Link>
              </>
            ) : (
              <Link href={signInHref as never} className="btn btn-primary btn-sm hidden sm:inline-flex">
                <Icon name="user" size={16} /> Sign in
              </Link>
            )}
            <button
              type="button"
              className="icon-btn !text-ink sm:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <Icon name={open ? 'close' : 'menu'} />
            </button>
          </div>
        </div>

        {open && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line sm:hidden">
            <ul className="wrap flex flex-col gap-1 py-4">
              {mobileNav.map((n) => (
                <li key={n.label}>
                  <Link
                    href={n.href as never}
                    aria-current={active(n.href) ? 'page' : undefined}
                    className={`flex items-center rounded-2xl px-4 py-3.5 text-[17px] ${
                      active(n.href) ? 'bg-soft text-accent [[data-theme=light]_&]:text-accent-ink' : 'text-ink-2'
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}

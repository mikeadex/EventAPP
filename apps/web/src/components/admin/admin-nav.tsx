'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Mark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icons';
import { ROLE_LABELS, type AdminMe } from '@/lib/admin-api';

export type AdminSection = 'overview' | 'hosts' | 'events' | 'reports' | 'flags';

type NavEntry =
  | { group: string }
  | { key: AdminSection; label: string; href: string; icon: IconName; count?: 'reports' };

// Only the screens this slice ships. Groups follow the design (Review queues,
// Directory); the rest of the design's links arrive with their screens.
const ITEMS: NavEntry[] = [
  { key: 'overview', label: 'Overview', href: '/admin', icon: 'dashboard' },
  { group: 'Review queues' },
  { key: 'reports', label: 'Reports', href: '/admin/reports', icon: 'flag', count: 'reports' },
  { group: 'Directory' },
  { key: 'hosts', label: 'Hosts', href: '/admin/hosts', icon: 'house' },
  { key: 'events', label: 'Events', href: '/admin/events', icon: 'calendar' },
  { group: 'Platform' },
  { key: 'flags', label: 'Feature flags', href: '/admin/flags', icon: 'bolt' },
];

function initials(me: AdminMe) {
  const source = me.name?.trim() || me.email.split('@')[0] || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : source.slice(0, 2);
  return letters.toUpperCase();
}

export function AdminNav({
  active,
  counts = {},
  staff,
  onSignOut,
}: {
  active?: AdminSection;
  counts?: { reports?: number };
  staff?: AdminMe;
  onSignOut?: () => void;
}) {
  // At ≤900px the nav is a sideways-scrolling row; keep the current page in view.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current || nav.scrollWidth <= nav.clientWidth) return;
    const n = nav.getBoundingClientRect();
    const c = current.getBoundingClientRect();
    if (c.right > n.right) nav.scrollLeft += c.right - n.right + 16;
    else if (c.left < n.left) nav.scrollLeft -= n.left - c.left + 16;
  }, [active]);

  return (
    <nav ref={navRef} className="anav" aria-label="Admin">
      <Link href="/admin" className="an-brand" aria-label="Ekklesia admin — overview">
        <Mark size={30} />
        <span className="flex flex-col leading-none">
          <span className="text-[20px] text-strong">ekklesia</span>
          <span className="mt-1 pl-[2px] text-[9px] tracking-[0.52em] text-accent">ADMIN</span>
        </span>
      </Link>

      <ul className="an-list">
        {ITEMS.map((item) => {
          if ('group' in item) {
            return (
              <li key={item.group} className="an-grp" aria-hidden="true">
                {item.group}
              </li>
            );
          }
          const on = item.key === active;
          const count = item.count ? counts[item.count] : undefined;
          return (
            <li key={item.key} className="contents">
              <Link
                href={item.href as never}
                className={on ? 'an on' : 'an'}
                aria-current={on ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                {item.label}
                {count ? (
                  <span className="an-count">
                    {count}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {staff ? (
        <div className="an-foot">
          <div className="rule-x" />
          <div className="flex items-center gap-3 p-2">
            <span
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border border-line-3 bg-avatar text-[13px] text-accent [[data-theme=light]_&]:text-accent-ink"
              aria-hidden="true"
            >
              {initials(staff)}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[14px] text-strong">{staff.name || staff.email}</span>
              <span className="text-[12px] text-muted">{ROLE_LABELS[staff.platformRole] ?? 'Staff'}</span>
            </span>
            <button type="button" className="icon-btn ml-auto" aria-label="Sign out" onClick={onSignOut}>
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

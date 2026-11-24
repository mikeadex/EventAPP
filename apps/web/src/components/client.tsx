'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from './icons';
import { apiClient } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import { signInHref } from '@/lib/url';

/* ---------------- Theme ---------------- */

type Theme = 'dark' | 'light';

const getTheme = (): Theme => (document.documentElement.dataset.theme as Theme) || 'dark';
const subscribeTheme = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('ek-theme', next);
        } catch {
          /* private mode: the choice just isn't remembered */
        }
      }}
      aria-label={`Switch to ${next} mode`}
      className={`icon-btn ${className}`}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/* ---------------- Saved events (synced with the API) ---------------- */

/**
 * One copy of the user's saved event ids for the whole page, so every heart
 * agrees and the list is fetched once. Loaded lazily the first time a heart
 * renders for a signed-in user.
 */
const saved = {
  ids: new Set<string>(),
  status: 'idle' as 'idle' | 'loading' | 'ready',
  listeners: new Set<() => void>(),
  version: 0,
  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  },
  async load() {
    if (this.status !== 'idle') return;
    this.status = 'loading';
    try {
      const rows = await apiClient<{ event: { id: string } }[]>('/v1/me/saved-events');
      this.ids = new Set(rows.map((r) => r.event.id));
    } catch {
      /* signed out or offline: hearts start empty */
    }
    this.status = 'ready';
    this.emit();
  },
};

function useSavedVersion() {
  return useSyncExternalStore(
    (cb) => {
      saved.listeners.add(cb);
      return () => saved.listeners.delete(cb);
    },
    () => saved.version,
    () => 0,
  );
}

export function SaveButton({
  eventId,
  title,
  size = 'md',
  onChange,
}: {
  eventId: string;
  title: string;
  size?: 'md' | 'lg';
  onChange?: (saved: boolean) => void;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  useSavedVersion();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (session?.user) void saved.load();
  }, [session?.user]);

  const isSaved = saved.ids.has(eventId);
  const dim = size === 'lg' ? 'h-[52px] w-[52px]' : 'h-10 w-10';

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;
    if (!session?.user) {
      const q = params.toString();
      router.push(signInHref(pathname + (q ? `?${q}` : '')) as never);
      return;
    }
    const next = !isSaved;
    // Optimistic: flip now, put it back if the server disagrees.
    if (next) saved.ids.add(eventId);
    else saved.ids.delete(eventId);
    saved.emit();
    setError(false);
    try {
      await apiClient(`/v1/me/saved-events/${eventId}`, { method: next ? 'POST' : 'DELETE' });
      onChange?.(next);
    } catch {
      if (next) saved.ids.delete(eventId);
      else saved.ids.add(eventId);
      saved.emit();
      setError(true);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${title} from saved` : `Save ${title}`}
      title={error ? 'Could not update saved events — try again' : undefined}
      onClick={toggle}
      className={`glass relative z-10 inline-flex ${dim} flex-none items-center justify-center rounded-full border transition-colors ${
        isSaved ? 'border-line-3 text-accent' : 'border-line-2 text-ink hover:text-accent'
      }`}
    >
      <Icon name="heart" size={size === 'lg' ? 22 : 18} filled={isSaved} />
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Share ${title}`}
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        } catch {
          /* share sheet dismissed */
        }
      }}
      className="glass inline-flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full border border-line-2 text-ink transition-colors hover:text-accent"
    >
      <Icon name={copied ? 'check' : 'share'} size={20} />
      <span className="sr-only" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </span>
    </button>
  );
}

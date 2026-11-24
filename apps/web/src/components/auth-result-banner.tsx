'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * Better Auth appends `?error=CODE` to the callback URL when an emailed link
 * fails, and otherwise just drops you on the page signed in.
 *
 * Without this the failure is silent: an expired verification link lands on the
 * home page looking like an ordinary visit, while the person still cannot sign
 * in and has no idea why. The 24-hour expiry makes that a common way to arrive.
 */
const MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: 'That verification link has expired. Sign in to get a new one.',
  INVALID_TOKEN: 'That verification link is not valid. Sign in to get a new one.',
  USER_NOT_FOUND: 'We could not find an account for that link.',
  INVALID_USER: 'That link belongs to a different account. Sign out and try again.',
};

export function AuthResultBanner() {
  const params = useSearchParams();
  const code = params.get('error');
  const [dismissed, setDismissed] = useState(false);

  // A new error should show even if the last one was dismissed.
  useEffect(() => {
    setDismissed(false);
  }, [code]);

  if (!code || dismissed) return null;

  return (
    <div role="status" className="border-b border-line bg-softer">
      <div className="wrap flex items-center gap-4 py-3 text-[14px] text-ink-2">
        <p className="flex-1">
          {/* Unknown codes still say something true rather than nothing. */}
          {MESSAGES[code] ?? 'That link could not be used. Sign in to try again.'}
        </p>
        <Link href="/sign-in" className="whitespace-nowrap text-accent">
          Sign in
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="icon-btn !h-8 !w-8"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

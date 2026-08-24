'use client';

import { useEffect, useState } from 'react';
import { apiClient, BASE } from '@/lib/api-client';

/**
 * Sign-in buttons for whichever providers this deployment can actually
 * complete. The list comes from /v1/config rather than being hard-coded, so a
 * provider whose credentials are not set simply has no button instead of one
 * that dead-ends at a broken consent screen.
 *
 * Renders nothing at all when none are configured — which is the current state
 * of production, and keeps the page tidy until credentials exist.
 */
const LABELS: Record<string, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
  microsoft: 'Continue with Microsoft',
};

/** Simple monochrome marks — the palette is deliberately colourless. */
function ProviderMark({ id }: { id: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor' } as const;
  if (id === 'apple') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M16.365 1.43c0 1.14-.42 2.2-1.26 3.03-.9.9-1.95 1.42-3.06 1.34-.06-1.1.42-2.2 1.26-3.03.87-.9 2.04-1.43 3.06-1.34zm3.6 16.2c-.51 1.17-1.11 2.28-1.98 3.27-.75.87-1.5 1.5-2.55 1.5-1.02 0-1.35-.63-2.55-.63-1.2 0-1.56.6-2.52.66-1.02.06-1.8-.93-2.55-1.8-1.56-1.86-2.79-5.28-1.17-7.59.81-1.17 2.19-1.89 3.66-1.92.99-.03 1.92.66 2.55.66.6 0 1.77-.81 2.97-.69.51.03 1.92.21 2.85 1.53-.07.05-1.71.99-1.68 2.97.03 2.37 2.1 3.15 2.13 3.16z" />
      </svg>
    );
  }
  if (id === 'microsoft') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 11v2.8h4.6c-.2 1.2-1.4 3.5-4.6 3.5-2.8 0-5-2.3-5-5.1S9.2 7.1 12 7.1c1.6 0 2.6.7 3.2 1.2l2.2-2.1C16 4.9 14.2 4.1 12 4.1c-4.4 0-8 3.6-8 8s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5-.1-.9-.1-1.3H12z" />
    </svg>
  );
}

/** Better Auth's codes are terse; say something a person can act on. */
const ERRORS: Record<string, string> = {
  please_restart_the_process: 'That took too long — please try again.',
  invalid_code: "Couldn't complete sign-in. Please try again.",
  account_not_linked:
    'An account with that email already exists. Sign in with your password first, then link this provider.',
};

export function SocialSignIn({ callbackURL = '/' }: { callbackURL?: string }) {
  const [providers, setProviders] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // A failed provider round trip comes back here with ?error=<code>.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setFailure(ERRORS[code] ?? 'Sign-in failed. Please try again.');
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient<{ socialProviders: string[] }>('/v1/config')
      .then((c) => {
        if (!cancelled) setProviders(c.socialProviders ?? []);
      })
      .catch(() => {
        /* no buttons rather than a broken page */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-100" />
        <span className="text-xs uppercase tracking-wider text-ink-400">or</span>
        <span className="h-px flex-1 bg-ink-100" />
      </div>
      {failure && (
        <p role="alert" className="mt-4 text-sm text-ink-700">
          {failure}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {providers.map((id) => (
          <button
            key={id}
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setPending(id);
              // A full navigation, not an XHR: the state cookie must be set
              // first-party on the API's own domain, or the browser drops it
              // and the callback fails with state_mismatch. The return URL is
              // absolute so we land back here rather than on the API root.
              const back = new URL(callbackURL, window.location.origin).toString();
              // On failure return to this page rather than the post-login
              // target, so the error is visible next to the sign-in form.
              // Path only: reusing the full href would stack an ?error= from a
              // previous attempt onto the next one.
              const onError = window.location.origin + window.location.pathname;
              window.location.href =
                `${BASE}/v1/social/start?provider=${encodeURIComponent(id)}` +
                `&redirect=${encodeURIComponent(back)}` +
                `&errorRedirect=${encodeURIComponent(onError)}`;
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-ink-200 px-4 py-2.5 font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-60"
          >
            <ProviderMark id={id} />
            {pending === id ? 'Redirecting…' : LABELS[id] ?? `Continue with ${id}`}
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiClient, ApiError } from './api-client';
import { useSession } from './auth-client';
import { signInHref } from './url';
import type { Me } from './types';

/**
 * Signed-in data is fetched from the browser, never during server rendering.
 *
 * The session cookie is set by the API on its own host (crossSubDomainCookies
 * is off), so the web server never receives it: a server component that
 * forwards `cookie` to the API sees nobody signed in, and in production every
 * such page bounced people to /sign-in. The browser does send the cookie to
 * the API (same site, SameSite=Lax), so the fetch belongs here.
 */
export type Loadable<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: string };

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading', data: null, error: null });
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    try {
      const data = await apiClient<T>(path);
      if (n === seq.current) setState({ status: 'ready', data, error: null });
    } catch (err) {
      if (n === seq.current)
        setState({
          status: 'error',
          data: null,
          error: err instanceof ApiError ? err.message : 'We couldn’t reach Ekklesia. Check your connection.',
        });
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Replace the data locally (optimistic updates) without refetching. */
  const mutate = useCallback((fn: (prev: T) => T) => {
    setState((s) => (s.status === 'ready' ? { ...s, data: fn(s.data) } : s));
  }, []);

  return { ...state, reload: load, mutate };
}

/**
 * Gate for pages that need a signed-in user: redirects to sign-in (coming
 * back here afterwards) once the session is known to be absent.
 */
export function useRequireSession() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (!isPending && !session?.user) {
      const q = params.toString();
      router.replace(signInHref(pathname + (q ? `?${q}` : '')) as never);
    }
  }, [isPending, session?.user, router, pathname, params]);

  return { user: session?.user ?? null, ready: !isPending && Boolean(session?.user) };
}

/** The signed-in user's API profile (memberships, permissions). */
export function useMe(enabled = true) {
  return useApi<Me>(enabled ? '/v1/me' : null);
}

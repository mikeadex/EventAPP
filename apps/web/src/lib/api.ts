import { headers as nextHeaders } from 'next/headers';
import type { EventSearchResult } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server-side API fetch. Auto-forwards the user's session cookie when
 * `auth: true` so authenticated /v1 endpoints see the caller.
 */
export async function api<T>(
  path: string,
  opts: { auth?: boolean; revalidate?: number | false; method?: string; body?: unknown } = {},
): Promise<T> {
  const { auth = false, revalidate = 60, method, body } = opts;
  const cookie = auth ? ((await nextHeaders()).get('cookie') ?? '') : '';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(revalidate === false || auth ? { cache: 'no-store' as const } : { next: { revalidate } }),
  });
  if (!res.ok) throw new Error(`API ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

/**
 * "Now", rounded down to five minutes. The search API returns past events
 * unless told otherwise, so every listing passes `startsAfter`; rounding keeps
 * the URL — and so the fetch cache key — stable between requests.
 */
export function nowRounded() {
  const step = 5 * 60 * 1000;
  return new Date(Math.floor(Date.now() / step) * step).toISOString();
}

export interface SearchParams {
  q?: string;
  category?: string;
  startsAfter?: string;
  startsBefore?: string;
  free?: boolean;
  limit?: number;
  cursor?: string;
}

/** Public event search. Upcoming only unless `startsAfter` says otherwise. */
export async function searchEvents(p: SearchParams = {}): Promise<EventSearchResult> {
  const qs = new URLSearchParams();
  qs.set('startsAfter', p.startsAfter ?? nowRounded());
  if (p.startsBefore) qs.set('startsBefore', p.startsBefore);
  if (p.q) qs.set('q', p.q);
  if (p.category) qs.set('category', p.category);
  if (p.free) qs.set('free', 'true');
  if (p.cursor) qs.set('cursor', p.cursor);
  qs.set('limit', String(p.limit ?? 24));
  return api<EventSearchResult>(`/v1/events?${qs.toString()}`);
}

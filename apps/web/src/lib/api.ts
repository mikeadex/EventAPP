import { headers as nextHeaders } from 'next/headers';

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
  const cookie = auth ? (await nextHeaders()).get('cookie') ?? '' : '';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    next: revalidate === false ? { revalidate: 0 } : { revalidate },
  });
  if (!res.ok) throw new Error(`API ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

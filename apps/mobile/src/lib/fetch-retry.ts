/**
 * fetch with a timeout and conservative retries, shared by the API client and
 * the auth client.
 *
 * Two things went wrong without it. A phone that has been asleep often fails
 * its first request while the radio and NAT bindings re-establish, and a
 * serverless API whose database connection went stale answers the first request
 * with a 500 (see apps/api/src/prisma/db-retry.ts). Either way one blip left a
 * screen stuck on an error until the user knew to pull-to-refresh.
 *
 * React Native's fetch also has no default timeout short enough to matter, so a
 * request that never answers used to spin indefinitely.
 */
const TIMEOUT_MS = 20_000;

/** Delay before each retry; length also sets how many retries are attempted. */
const RETRY_DELAYS_MS = [300, 900];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  // A network-level failure gives no evidence about whether the server applied
  // the request, so only methods that are safe to repeat get replayed. A 5xx is
  // different: the server is telling us it did not process the request at all.
  const safeToReplay = method === 'GET' || method === 'HEAD';

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return res;
    } catch (err) {
      if (!safeToReplay || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    } finally {
      clearTimeout(timer);
    }
  }
}

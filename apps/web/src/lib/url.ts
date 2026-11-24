/**
 * Only same-site paths are honoured as a post-sign-in destination. Browsers
 * treat `/\\evil.com` like `//evil.com`, so backslashes and control
 * characters are refused, and the result must resolve to our own origin.
 */
export function safeNext(next: string | null | undefined, fallback = '/') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\x00-\x1f]/.test(next)) return fallback;
  try {
    const u = new URL(next, 'https://x.invalid');
    if (u.origin !== 'https://x.invalid') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** A host-supplied link, only if it is http(s) — never `javascript:` and friends. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

export function signInHref(next: string) {
  return `/sign-in?next=${encodeURIComponent(next)}`;
}

/** Public URL of an event page. Events live under their host's slug. */
export function eventHref(e: { slug: string; organization: { slug: string } }) {
  return `/${e.organization.slug}/${e.slug}`;
}

import type { Request } from 'express';

/**
 * Client IP for audit rows and rate limits. The left-most X-Forwarded-For
 * entry is whatever the client sent, so it is never trusted: Vercel's own
 * header first, then X-Real-IP, then the right-most X-Forwarded-For entry (the
 * one our nearest proxy appended).
 */
export function clientIp(headers: Pick<Headers, 'get'> | undefined): string | undefined {
  const vercel = headers?.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercel) return vercel;
  const real = headers?.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers
    ?.get('x-forwarded-for')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return forwarded?.[forwarded.length - 1] || undefined;
}

/** clientIp for an Express request, falling back to the socket address. */
export function requestClientIp(req: Request | undefined): string | undefined {
  if (!req) return undefined;
  const headers = {
    get(name: string): string | null {
      const v = req.headers?.[name.toLowerCase()];
      if (Array.isArray(v)) return v.join(',');
      return typeof v === 'string' ? v : null;
    },
  };
  return clientIp(headers) ?? req.socket?.remoteAddress ?? undefined;
}

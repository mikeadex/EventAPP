'use client';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: unknown,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Browser-side fetch with cookies attached, JSON in/out, and a typed error
 * for callers to render server-issued validation messages.
 */
export async function apiClient<T = unknown>(
  path: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const payload = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed: ${res.status}`);
    throw new ApiError(res.status, payload, msg);
  }
  return payload as T;
}

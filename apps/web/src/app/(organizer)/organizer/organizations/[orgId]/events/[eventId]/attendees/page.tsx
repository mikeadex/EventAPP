'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Route } from 'next';
import { apiClient, ApiError } from '@/lib/api-client';

interface Attendee {
  id: string;
  code: string;
  status: string;
  checkedInAt: string | null;
  name: string;
  email: string | null;
  ticketType: { name: string; priceMinor: number; currency: string } | null;
}

interface AttendeeList {
  items: Attendee[];
  total: number;
  checkedIn: number;
}

/**
 * An already-admitted ticket is the common case on a door, so it gets the time
 * in local format rather than the ISO string the API carries.
 */
function describeFailure(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Check-in failed';
  const payload = err.payload as { checkedInAt?: string; name?: string } | null;
  if (err.status === 409 && payload?.checkedInAt) {
    const at = new Date(payload.checkedInAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${payload.name ?? 'This ticket'} was already checked in at ${at}`;
  }
  return err.message;
}

export default function AttendeesPage() {
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>();
  const [list, setList] = useState<AttendeeList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setList(await apiClient<AttendeeList>(`/v1/events/${eventId}/tickets`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load attendees');
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkIn(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setResult(null);
    try {
      const res = await apiClient<{ name: string }>(`/v1/events/${eventId}/check-in`, {
        method: 'POST',
        body: { code: code.trim() },
      });
      setResult({ ok: true, text: `${res.name} checked in` });
      setCode('');
      await load();
    } catch (err) {
      setResult({ ok: false, text: describeFailure(err) });
    } finally {
      setPending(false);
      // Keep focus in the box so codes can be entered back to back.
      codeInput.current?.focus();
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/organizer/organizations/${orgId}/events/${eventId}/edit` as Route}
        className="text-sm text-brand-600 hover:underline"
      >
        ← Back to event
      </Link>
      <h1 className="mt-2 font-display text-3xl text-ink-900">Attendees</h1>
      {list && (
        <p className="mt-1 text-ink-500">
          {list.checkedIn} of {list.total} checked in
        </p>
      )}

      <form onSubmit={checkIn} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Ticket code</span>
          <input
            ref={codeInput}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EK-XXXXXXXXXXX"
            autoComplete="off"
            className="mt-1 w-64 rounded-md border border-ink-200 bg-white px-3 py-2 font-mono text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Checking…' : 'Check in'}
        </button>
      </form>

      {result && (
        <p
          role="status"
          className={`mt-3 rounded-md border p-3 text-sm ${
            result.ok
              ? 'border-ink-200 bg-ink-50 text-ink-800'
              : 'border-danger/30 bg-danger/5 text-danger'
          }`}
        >
          {result.text}
        </p>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      {list && list.items.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-ink-200 p-6 text-center text-ink-500">
          Nobody has registered yet.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-ink-100 rounded-md border border-ink-100">
          {list?.items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900">{a.name}</p>
                <p className="truncate text-sm text-ink-500">
                  {a.email ?? 'No email'} · <span className="font-mono">{a.code}</span>
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  a.status === 'CHECKED_IN'
                    ? 'bg-ink-900 text-white'
                    : 'border border-ink-200 text-ink-600'
                }`}
              >
                {a.status === 'CHECKED_IN' ? 'Checked in' : 'Registered'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

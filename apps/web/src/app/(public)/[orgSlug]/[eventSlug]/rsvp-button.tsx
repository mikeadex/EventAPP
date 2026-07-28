'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { apiClient, ApiError } from '@/lib/api-client';

export function RsvpButton({ eventId, disabled }: { eventId: string; disabled?: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return (
      <button
        disabled
        className="rounded-md bg-ink-200 px-5 py-2.5 font-medium text-ink-500"
      >
        Unavailable
      </button>
    );
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`)}
        className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        Sign in to RSVP
      </button>
    );
  }

  async function rsvp() {
    setPending(true);
    setError(null);
    try {
      await apiClient(`/v1/events/${eventId}/rsvp`, { method: 'POST', body: {} });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'RSVP failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={rsvp}
        disabled={pending || done}
        className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {done ? 'You’re going ✓' : pending ? 'Reserving…' : 'RSVP'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-2 text-sm text-ink-500">
          Check{' '}
          <a href="/me/tickets" className="text-brand-700 hover:underline">
            My tickets
          </a>
          .
        </p>
      )}
    </div>
  );
}

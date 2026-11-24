'use client';

import { apiClient, ApiError } from './api-client';
import { fmtTime } from './format';

export type CheckInResult =
  | { kind: 'valid'; name: string; code: string; at: string }
  | { kind: 'used'; name: string; code: string; at: string | null }
  | { kind: 'wrong'; code: string; message: string }
  | { kind: 'invalid'; code: string; message: string };

/**
 * Admit one ticket and say plainly what happened. Check-in is one-way: the
 * API has no undo, so the door UI never offers one.
 */
export async function checkInCode(eventId: string, raw: string): Promise<CheckInResult> {
  const code = raw.trim().toUpperCase();
  try {
    const res = await apiClient<{ name: string; checkedInAt: string }>(`/v1/events/${eventId}/check-in`, {
      method: 'POST',
      body: { code },
    });
    return { kind: 'valid', name: res.name, code, at: res.checkedInAt };
  } catch (err) {
    if (err instanceof ApiError) {
      const p = err.payload as { name?: string; checkedInAt?: string | null } | null;
      if (err.status === 409) return { kind: 'used', name: p?.name ?? 'This ticket', code, at: p?.checkedInAt ?? null };
      // Codes are scoped to the event, so another event's ticket reads as 404.
      if (err.status === 404) return { kind: 'wrong', code, message: 'No ticket for this event has that code.' };
      return { kind: 'invalid', code, message: err.message };
    }
    return { kind: 'invalid', code, message: 'We couldn’t reach Ekklesia. Check the connection and try again.' };
  }
}

export function describeResult(r: CheckInResult) {
  switch (r.kind) {
    case 'valid':
      return { title: `${r.name} is in`, body: `Checked in at ${fmtTime(r.at)}.` };
    case 'used':
      return { title: 'Already checked in', body: `${r.name}${r.at ? ` came in at ${fmtTime(r.at)}` : ' was already admitted'}.` };
    case 'wrong':
      return { title: 'Not for this event', body: r.message };
    case 'invalid':
      return { title: 'Can’t admit this ticket', body: r.message };
  }
}

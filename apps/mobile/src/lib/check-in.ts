import { api, ApiError } from './api';

/**
 * Checking a ticket in, shared by the attendee list and the scanner.
 *
 * Extracted rather than duplicated because the failure wording is the part that
 * matters most at a door: "already checked in at 10:42" is the difference
 * between waving someone through and turning them away, and two copies of that
 * logic would drift.
 */
export type CheckInResult = { ok: true; name: string } | { ok: false; message: string };

export async function checkInTicket(eventId: string, code: string): Promise<CheckInResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, message: 'No ticket code' };
  try {
    const res = await api<{ name: string }>(`/v1/events/${eventId}/check-in`, {
      method: 'POST',
      body: { code: trimmed },
    });
    return { ok: true, name: res.name };
  } catch (e) {
    return { ok: false, message: describeCheckInFailure(e) };
  }
}

export function describeCheckInFailure(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Check-in failed';
  const payload = err.payload as { checkedInAt?: string; name?: string } | null;
  // A duplicate scan is the common case at a busy door, and it is not really an
  // error — say who and when, so the person on the gate can judge it.
  if (err.status === 409 && payload?.checkedInAt) {
    const at = new Date(payload.checkedInAt).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${payload.name ?? 'This ticket'} was already checked in at ${at}`;
  }
  return err.message;
}

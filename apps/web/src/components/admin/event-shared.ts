import type { StatusTone } from './status-pill';

export type EventStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

/** The fields the status helpers read; both the host profile and the events list have them. */
export interface EventTiming {
  status: EventStatus;
  endsAt: string;
  attendeeCount: number;
  capacity: number | null;
}

/** Published and not over yet. */
export function isUpcoming(e: Pick<EventTiming, 'status' | 'endsAt'>, now: number) {
  return e.status === 'PUBLISHED' && new Date(e.endsAt).getTime() >= now;
}

export function eventStatus(e: Pick<EventTiming, 'status' | 'endsAt'>, now: number): [StatusTone, string] {
  switch (e.status) {
    case 'PUBLISHED':
      return isUpcoming(e, now) ? ['ok', 'Live'] : ['default', 'Ended'];
    case 'COMPLETED':
      return ['default', 'Ended'];
    case 'CANCELLED':
      return ['bad', 'Unpublished'];
    case 'SCHEDULED':
      return ['default', 'Scheduled'];
    default:
      return ['default', 'Draft'];
  }
}

export function booked(e: Pick<EventTiming, 'attendeeCount' | 'capacity'>) {
  return e.capacity ? `${e.attendeeCount} / ${e.capacity}` : String(e.attendeeCount);
}

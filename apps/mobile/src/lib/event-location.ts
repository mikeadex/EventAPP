/**
 * How an event is attended. The database has never modelled this as a single
 * field — `isOnline`, `venueId` and `onlineUrl` are independent — so a hybrid
 * event is simply one that has both. Only the clients ever forced an either/or,
 * which is why hybrids could not be created.
 */
export type LocationMode = 'in_person' | 'online' | 'hybrid';

export interface EventLocation {
  isOnline: boolean;
  onlineUrl?: string | null;
  venue?: { name: string; city?: string | null } | null;
}

export function locationMode(e: EventLocation): LocationMode {
  if (e.isOnline && e.venue) return 'hybrid';
  return e.isOnline ? 'online' : 'in_person';
}

/** Short form for the info strip, where there is room for a word or two. */
export function locationLabel(e: EventLocation): string {
  const place = e.venue?.city || e.venue?.name;
  switch (locationMode(e)) {
    case 'online':
      return 'Online';
    case 'hybrid':
      // The column is ~a third of the screen; "York + online" truncates to
      // "York + o…". The stream row underneath carries the online half.
      return place ?? 'Online';
    default:
      return place ?? 'TBA';
  }
}

/** Fuller form for share text and calendar entries. */
export function locationLine(e: EventLocation): string {
  const place = e.venue ? [e.venue.name, e.venue.city].filter(Boolean).join(', ') : null;
  switch (locationMode(e)) {
    case 'online':
      return 'Online';
    case 'hybrid':
      return place ? `${place} (also online)` : 'Online';
    default:
      return place ?? '';
  }
}

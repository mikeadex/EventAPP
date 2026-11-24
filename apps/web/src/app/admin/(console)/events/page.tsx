import { Suspense } from 'react';
import { EventsTable } from './events-table';

export const metadata = { title: 'Events' };

export default function AdminEventsPage() {
  // The table reads its filters from the URL (useSearchParams), which needs a
  // Suspense boundary on a statically rendered page.
  return (
    <Suspense fallback={<p className="text-[14px] text-muted">Loading events…</p>}>
      <EventsTable />
    </Suspense>
  );
}

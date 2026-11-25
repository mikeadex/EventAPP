import { Suspense } from 'react';
import { EventsTable } from './events-table';
import { Skeleton } from '@/components/ui';

export const metadata = { title: 'Events' };

export default function AdminEventsPage() {
  // The table reads its filters from the URL (useSearchParams), which needs a
  // Suspense boundary on a statically rendered page.
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <EventsTable />
    </Suspense>
  );
}

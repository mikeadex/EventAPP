import { Suspense } from 'react';
import { HostsTable } from './hosts-table';
import { Skeleton } from '@/components/ui';

export const metadata = { title: 'Hosts' };

export default function AdminHostsPage() {
  // The table reads its filters from the URL (useSearchParams), which needs a
  // Suspense boundary on a statically rendered page.
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <HostsTable />
    </Suspense>
  );
}

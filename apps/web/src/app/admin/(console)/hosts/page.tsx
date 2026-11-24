import { Suspense } from 'react';
import { HostsTable } from './hosts-table';

export const metadata = { title: 'Hosts' };

export default function AdminHostsPage() {
  // The table reads its filters from the URL (useSearchParams), which needs a
  // Suspense boundary on a statically rendered page.
  return (
    <Suspense fallback={<p className="text-[14px] text-muted">Loading hosts…</p>}>
      <HostsTable />
    </Suspense>
  );
}

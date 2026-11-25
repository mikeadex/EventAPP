import { Suspense } from 'react';
import { AddForChurch } from './add-for-church';

export const metadata = { title: 'Add event for a church' };

export default function AdminAddEventPage() {
  // The form reads ?hostId= (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-[14px] text-muted">Loading…</p>}>
      <AddForChurch />
    </Suspense>
  );
}

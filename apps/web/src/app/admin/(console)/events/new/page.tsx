import { Suspense } from 'react';
import { AddForChurch } from './add-for-church';
import { Skeleton } from '@/components/ui';

export const metadata = { title: 'Add event for a church' };

export default function AdminAddEventPage() {
  // The form reads ?hostId= (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <AddForChurch />
    </Suspense>
  );
}

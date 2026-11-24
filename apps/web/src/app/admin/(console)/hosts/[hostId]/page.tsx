import { Suspense } from 'react';
import { HostProfile } from './host-profile';

export const metadata = { title: 'Host' };

export default async function AdminHostPage({ params }: { params: Promise<{ hostId: string }> }) {
  const { hostId } = await params;
  // The profile reads ?tab= (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense fallback={<p className="text-[14px] text-muted">Loading host…</p>}>
      <HostProfile hostId={hostId} />
    </Suspense>
  );
}

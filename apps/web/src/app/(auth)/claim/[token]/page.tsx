import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClaimFlow } from './claim-flow';

// The URL carries a working claim token: never index it, never send it on.
export const metadata: Metadata = {
  title: 'Claim your church',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<{ token: string }>;

export default async function ClaimPage({ params }: { params: Params }) {
  const { token } = await params;
  return (
    <Suspense fallback={null}>
      <ClaimFlow token={token} />
    </Suspense>
  );
}

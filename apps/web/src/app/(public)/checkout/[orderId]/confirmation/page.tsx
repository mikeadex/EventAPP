import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ConfirmationView } from './confirmation-view';

export const metadata: Metadata = { title: 'Booking confirmation', robots: { index: false } };

export default async function ConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <Suspense fallback={null}>
      <ConfirmationView orderId={orderId} />
    </Suspense>
  );
}

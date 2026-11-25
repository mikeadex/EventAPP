import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CheckoutView } from './checkout-view';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <div className="wrap max-w-[1120px] pt-10">
      <Suspense fallback={null}>
        <CheckoutView orderId={orderId} />
      </Suspense>
    </div>
  );
}

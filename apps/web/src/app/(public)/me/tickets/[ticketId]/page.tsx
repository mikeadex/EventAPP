import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TicketView } from './ticket-view';

export const metadata: Metadata = { title: 'Your ticket', robots: { index: false } };

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return (
    <div className="wrap max-w-[1040px] pt-10">
      <Suspense fallback={null}>
        <TicketView ticketId={ticketId} />
      </Suspense>
    </div>
  );
}

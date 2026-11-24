import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TicketsList } from './tickets-list';

export const metadata: Metadata = { title: 'Your tickets', robots: { index: false } };

export default function MyTicketsPage() {
  return (
    <div className="wrap max-w-[1040px] py-12">
      <Suspense fallback={null}>
        <TicketsList />
      </Suspense>
    </div>
  );
}

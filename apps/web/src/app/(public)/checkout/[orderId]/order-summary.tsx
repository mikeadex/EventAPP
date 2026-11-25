'use client';

import type { ReactNode } from 'react';
import { amount, fmtDay, fmtTime } from '@/lib/format';
import type { OrderDetail } from '@/lib/payments';

/** The design's date tile: month eyebrow over the day number. */
export function DateTile({ iso, tz }: { iso: string; tz?: string }) {
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: tz }).format(new Date(iso)).toUpperCase();
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: tz }).format(new Date(iso));
  return (
    <span
      className="flex h-[72px] w-[72px] flex-none flex-col items-center justify-center rounded-2xl border border-line-2 bg-raised"
      aria-hidden="true"
    >
      <span className="eyebrow text-[10px] text-accent">{month}</span>
      <span className="text-[26px] leading-none text-strong">{day}</span>
    </span>
  );
}

/** The order's lines: tickets, the one booking fee, the total. */
export function OrderLines({ order, children }: { order: OrderDetail; children?: ReactNode }) {
  return (
    <dl className="flex flex-col gap-2.5 text-[15px]">
      {order.items.map((item) => (
        <div key={item.ticketType.id} className="flex justify-between gap-4">
          <dt className="text-ink-2">
            {item.quantity} × {item.ticketType.name}
          </dt>
          <dd className="font-mono">{amount(item.unitPriceMinor * item.quantity, order.currency)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4">
        <dt className="text-ink-2">Booking fee</dt>
        <dd className="font-mono">{amount(order.platformFeeMinor, order.currency)}</dd>
      </div>
      {children}
    </dl>
  );
}

/** "Sat 5 Dec · 19:00 · Venue" under an event title. */
export function whenLine(startsAt: string, tz?: string, place?: string | null) {
  return [`${fmtDay(startsAt, tz)} · ${fmtTime(startsAt, tz)}`, place].filter(Boolean).join(' · ');
}

/** "2 × Single seat" or "3 tickets" across types. */
export function ticketsLine(order: OrderDetail) {
  if (order.items.length === 1) {
    const i = order.items[0]!;
    return `${i.quantity} × ${i.ticketType.name}`;
  }
  const n = order.items.reduce((s, i) => s + i.quantity, 0);
  return `${n} tickets`;
}

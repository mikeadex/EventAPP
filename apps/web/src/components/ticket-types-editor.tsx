'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  quantity: number;
  sold: number;
  perOrderMax: number;
}

/** Money is stored in minor units; organisers think in pounds. */
function formatPrice(minor: number, currency: string): string {
  if (minor === 0) return 'Free';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
}

export function TicketTypesEditor({
  eventId,
  disabled = false,
}: {
  eventId: string;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<TicketType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('GBP');
  const [quantity, setQuantity] = useState('100');

  const load = useCallback(async () => {
    try {
      const res = await apiClient<{ items: TicketType[] }>(`/v1/events/${eventId}/ticket-types`);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load ticket types');
    } finally {
      setLoaded(true);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiClient(`/v1/events/${eventId}/ticket-types`, {
        method: 'POST',
        body: {
          name,
          // Pounds in the field, pence over the wire. Rounded because 19.99
          // times 100 is not exactly 1999 in binary floating point.
          priceMinor: Math.round(Number(price) * 100),
          currency,
          quantity: Number(quantity),
        },
      });
      setName('');
      setPrice('0');
      setQuantity('100');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add ticket type');
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError(null);
    try {
      await apiClient(`/v1/events/${eventId}/ticket-types/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete ticket type');
    } finally {
      setPending(false);
    }
  }

  const hasPaid = items.some((t) => t.priceMinor > 0);

  return (
    <section>
      <h2 className="font-display text-xl text-ink-900">Tickets</h2>
      <p className="mt-1 text-sm text-ink-500">
        With no ticket types, the event takes free RSVPs. Add a priced type to sell tickets.
      </p>

      {!loaded ? (
        <p className="mt-4 text-sm text-ink-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ink-200 p-4 text-sm text-ink-500">
          No ticket types yet — this event accepts free RSVPs.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-100 rounded-md border border-ink-100">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{t.name}</p>
                <p className="text-sm text-ink-500">
                  {formatPrice(t.priceMinor, t.currency)} · {t.sold}/{t.quantity} issued
                </p>
              </div>
              <button
                type="button"
                disabled={disabled || pending || t.sold > 0}
                onClick={() => void remove(t.id)}
                title={t.sold > 0 ? 'Tickets have been issued for this type' : undefined}
                className="shrink-0 rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasPaid && (
        <p className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
          Paid tickets need Stripe keys configured in production before checkout will work.
          Free RSVP is disabled while a priced type exists.
        </p>
      )}

      <form onSubmit={add} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Name</span>
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Standard"
            className={`${fieldStyle} w-44`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Price</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${fieldStyle} w-28`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={`${fieldStyle} w-24`}
          >
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Quantity</span>
          <input
            required
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={`${fieldStyle} w-28`}
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending}
          className="rounded-md border border-ink-200 px-4 py-2 font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-60"
        >
          Add ticket type
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

const fieldStyle =
  'mt-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { money } from '@/lib/format';
import { Field } from './controls';
import { Icon } from './icons';
import { Skeleton } from '@/components/ui';

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

/**
 * The places an event offers.
 *
 * Free only. RSVP refuses any event that has a priced ticket type, and there
 * is no checkout yet, so a priced type used to turn a live event into one
 * nobody could book. TODO(confirm): restore priced types when payments launch.
 *
 * Bookings are taken against the first type, so naming it ("Adults", "Seat")
 * changes what attendees see; adding more doesn't split the capacity.
 */
export function TicketTypesEditor({ eventId, disabled = false }: { eventId: string; disabled?: boolean }) {
  const [items, setItems] = useState<TicketType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient<{ items: TicketType[] }>(`/v1/events/${eventId}/ticket-types`);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t load the places for this event.');
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
          name: name.trim(),
          priceMinor: 0,
          currency: items[0]?.currency ?? 'GBP',
          quantity: quantity ? Number(quantity) : 1_000_000,
        },
      });
      setName('');
      setQuantity('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t add that.');
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
      setError(err instanceof ApiError ? err.message : 'We couldn’t remove that.');
    } finally {
      setPending(false);
    }
  }

  const paid = items.filter((t) => t.priceMinor > 0);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-[22px] text-strong">Ticket types</h2>
        <p className="mt-1 text-[14px] text-body">
          Optional. Without any, people simply reserve a free place. Paid tickets aren&rsquo;t available yet.
        </p>
      </div>

      {paid.length > 0 && (
        <p role="alert" className="flex items-start gap-3 rounded-2xl border border-line-3 bg-soft p-4 text-[14px] leading-relaxed">
          <Icon name="alert" className="mt-0.5 flex-none text-accent" />
          <span>
            This event has a priced ticket type, so nobody can book it — online payment isn&rsquo;t live. Remove{' '}
            {paid.map((t) => `“${t.name}”`).join(', ')} to open free bookings.
          </span>
        </p>
      )}

      {!loaded ? (
        <ul className="divide-y divide-line rounded-panel border border-line" aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className="p-4">
              <Skeleton className="h-10" />
            </li>
          ))}
        </ul>
      ) : items.length > 0 ? (
        <ul className="divide-y divide-line rounded-panel border border-line">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-[16px] text-strong">{t.name}</p>
                <p className="text-[13px] text-muted">
                  {t.priceMinor === 0 ? 'Free' : money(t.priceMinor, t.currency)} · {t.sold} booked
                  {t.quantity < 1_000_000 ? ` of ${t.quantity}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled || pending || t.sold > 0}
                onClick={() => void remove(t.id)}
                title={t.sold > 0 ? 'People have booked this — it can’t be removed' : undefined}
                className="btn btn-ghost btn-sm"
                aria-label={`Remove ${t.name}`}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={add} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Name">
            {(p) => (
              <input
                {...p}
                required
                maxLength={80}
                className="input"
                placeholder="Free place"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="sm:w-[160px]">
          <Field label="How many">
            {(p) => (
              <input
                {...p}
                type="number"
                min={1}
                inputMode="numeric"
                className="input"
                placeholder="No limit"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            )}
          </Field>
        </div>
        <button type="submit" disabled={disabled || pending || !name.trim()} className="btn btn-outline">
          <Icon name="plus" size={16} /> Add
        </button>
      </form>

      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}

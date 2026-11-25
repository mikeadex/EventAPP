'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { money } from '@/lib/format';
import { NO_LIMIT, priceToMinor } from '@/components/host/event-form';
import { Field } from './controls';
import { Icon } from './icons';
import { Skeleton } from '@/components/ui';

export interface TicketType {
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
 * Free events: optional. Without any type, people simply reserve a free
 * place, and bookings are taken against the first type, so naming it
 * ("Adults", "Seat") changes what attendees see.
 *
 * Paid events (`paid`): each type has a price in pounds, stored as
 * `priceMinor`, and attendees buy through checkout. The API refuses a free
 * RSVP on an event with any priced type, and refuses a paid order containing
 * a free one, so an event is one or the other: switching kind here means
 * the types of the other kind should go.
 */
export function TicketTypesEditor({
  eventId,
  disabled = false,
  paid = false,
  onLoaded,
}: {
  eventId: string;
  disabled?: boolean;
  /** Show a price per type and require one. */
  paid?: boolean;
  /** Called with the types once they're loaded, and after each change. */
  onLoaded?: (items: TicketType[]) => void;
}) {
  const [items, setItems] = useState<TicketType[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient<{ items: TicketType[] }>(`/v1/events/${eventId}/ticket-types`);
      setItems(res.items);
      onLoaded?.(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t load the places for this event.');
    } finally {
      setLoaded(true);
    }
    // onLoaded is a notification, not an input: a new function each render
    // must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const priceMinor = paid ? priceToMinor(price) : 0;
  const priceError = paid && price && (priceMinor === null || priceMinor < 100) ? 'Use a price of £1 or more, like 10 or 12.50.' : null;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (paid && (priceMinor === null || priceMinor < 100)) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/v1/events/${eventId}/ticket-types`, {
        method: 'POST',
        body: {
          name: name.trim(),
          priceMinor: priceMinor ?? 0,
          currency: items[0]?.currency ?? 'GBP',
          quantity: quantity ? Number(quantity) : NO_LIMIT,
        },
      });
      setName('');
      setPrice('');
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

  // Types of the other kind block bookings (see above), so point them out.
  const mismatched = items.filter((t) => (paid ? t.priceMinor === 0 : t.priceMinor > 0));

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="text-[22px] text-strong">Ticket types</h2>
        <p className="mt-1 text-[14px] text-body">
          {paid
            ? 'What people can buy. Each type has its own price; attendees pay one booking fee on top.'
            : 'Optional. Without any, people simply reserve a free place.'}
        </p>
      </div>

      {mismatched.length > 0 && (
        <p role="alert" className="flex items-start gap-3 rounded-2xl border border-line-3 bg-soft p-4 text-[14px] leading-relaxed">
          <Icon name="alert" className="mt-0.5 flex-none text-accent" />
          <span>
            {paid
              ? `A paid event can’t also offer free places. Remove ${mismatched.map((t) => `“${t.name}”`).join(', ')} or switch to Free.`
              : `A free event can’t sell tickets. Remove ${mismatched.map((t) => `“${t.name}”`).join(', ')} or switch to Paid.`}
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
                  {t.priceMinor === 0 ? 'Free' : money(t.priceMinor, t.currency)} · {t.sold}{' '}
                  {t.priceMinor === 0 ? 'booked' : 'sold'}
                  {t.quantity < NO_LIMIT ? ` of ${t.quantity}` : ''}
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

      <form onSubmit={add} className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Field label="Name">
            {(p) => (
              <input
                {...p}
                required
                maxLength={80}
                className="input"
                placeholder={paid ? 'General admission' : 'Free place'}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
        </div>
        {paid && (
          <div className="sm:w-[140px]">
            <Field label="Price (£)" error={priceError}>
              {(p) => (
                <input
                  {...p}
                  required
                  inputMode="decimal"
                  className="input font-mono"
                  placeholder="10.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              )}
            </Field>
          </div>
        )}
        <div className="sm:w-[150px]">
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
        <button
          type="submit"
          disabled={disabled || pending || !name.trim() || (paid && (priceMinor === null || priceMinor < 100))}
          className="btn btn-outline sm:mt-[30px]"
        >
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

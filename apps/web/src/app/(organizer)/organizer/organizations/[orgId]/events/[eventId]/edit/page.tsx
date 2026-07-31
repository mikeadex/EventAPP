'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import { apiClient, ApiError } from '@/lib/api-client';
import { ImageUpload } from '@/components/image-upload';
import { TicketTypesEditor } from '@/components/ticket-types-editor';

const CATEGORIES = [
  'service', 'worship', 'prayer', 'youth', 'kids', 'small_group',
  'conference', 'outreach', 'social', 'fundraiser', 'class', 'other',
] as const;

interface EventDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | string;
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  venue: {
    name: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
  } | null;
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('service');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [venueName, setVenueName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('GB');
  const [capacity, setCapacity] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const hydrate = useCallback((e: EventDetail) => {
    setEvent(e);
    setTitle(e.title);
    setSummary(e.summary ?? '');
    setDescription(e.description ?? '');
    setCategory(e.category.toLowerCase());
    setStartsAt(toLocalInput(e.startsAt));
    setEndsAt(toLocalInput(e.endsAt));
    setIsOnline(e.isOnline);
    setOnlineUrl(e.onlineUrl ?? '');
    setVenueName(e.venue?.name ?? '');
    setAddressLine1(e.venue?.addressLine1 ?? '');
    setCity(e.venue?.city ?? '');
    setPostalCode(e.venue?.postalCode ?? '');
    setCountry(e.venue?.country ?? 'GB');
    setCapacity(e.capacity === null ? '' : String(e.capacity));
    setCoverImageUrl(e.coverImageUrl);
  }, []);

  useEffect(() => {
    apiClient<EventDetail>(`/v1/events/${eventId}`)
      .then(hydrate)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Could not load this event'),
      );
  }, [eventId, hydrate]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await apiClient(`/v1/events/${eventId}`, {
        method: 'PATCH',
        body: {
          title,
          summary: summary || undefined,
          description: description || undefined,
          category,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          isOnline,
          onlineUrl: isOnline ? onlineUrl : null,
          capacity: capacity ? Number(capacity) : null,
          coverImageUrl: coverImageUrl ?? null,
          venue: isOnline
            ? null
            : { name: venueName, addressLine1, city, postalCode, country },
        },
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  async function transition(action: 'publish' | 'cancel') {
    if (action === 'cancel' && !confirm('Cancel this event? Attendees keep their tickets but the event is closed.')) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiClient(`/v1/events/${eventId}/${action}`, { method: 'POST', body: {} });
      const fresh = await apiClient<EventDetail>(`/v1/events/${eventId}`);
      hydrate(fresh);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <p role="alert" className="text-danger">{loadError}</p>
        <Link href={`/organizer/organizations/${orgId}` as Route} className="mt-4 inline-block text-brand-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }
  if (!event) return <p className="text-ink-500">Loading…</p>;

  const cancelled = event.status === 'CANCELLED';

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-400">{event.status}</p>
          <h1 className="mt-1 font-display text-3xl text-ink-900">Edit event</h1>
          <p className="mt-1 text-ink-500">
            {event.attendeeCount} attending ·{' '}
            <Link
              href={`/organizer/organizations/${orgId}/events/${eventId}/attendees` as Route}
              className="text-brand-600 hover:underline"
            >
              View attendees
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {event.status === 'DRAFT' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void transition('publish')}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Publish
            </button>
          )}
          {event.status === 'PUBLISHED' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => void transition('cancel')}
              className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-60"
            >
              Cancel event
            </button>
          )}
        </div>
      </div>

      {cancelled && (
        <p className="mt-6 rounded-md border border-ink-200 bg-ink-50 p-4 text-sm text-ink-600">
          This event is cancelled and can no longer be edited.
        </p>
      )}

      <fieldset disabled={cancelled} className="contents">
        <form onSubmit={save} className="mt-8 space-y-5">
          <ImageUpload
            purpose="event_cover"
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            label="Cover image"
            hint="Recommended 1600×700. Shown on event cards and detail page."
          />

          <Field label="Title">
            <input required minLength={3} maxLength={140} value={title}
              onChange={(e) => setTitle(e.target.value)} className={fieldStyle} />
          </Field>

          <Field label="Short summary" hint="One line. Shown on event cards.">
            <input maxLength={280} value={summary}
              onChange={(e) => setSummary(e.target.value)} className={fieldStyle} />
          </Field>

          <Field label="Description">
            <textarea rows={5} maxLength={10000} value={description}
              onChange={(e) => setDescription(e.target.value)} className={fieldStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Capacity" hint="Leave blank for no limit.">
              <input type="number" min={1} value={capacity}
                onChange={(e) => setCapacity(e.target.value)} className={fieldStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts at">
              <input type="datetime-local" required value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)} className={fieldStyle} />
            </Field>
            <Field label="Ends at">
              <input type="datetime-local" required value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)} className={fieldStyle} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
            This is an online event
          </label>

          {isOnline ? (
            <Field label="Stream URL">
              <input type="url" required value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)} className={fieldStyle} />
            </Field>
          ) : (
            <div className="space-y-3 rounded-md border border-ink-100 bg-ink-50 p-4">
              <p className="text-xs uppercase tracking-wider text-ink-400">Venue</p>
              <Field label="Venue name">
                <input required value={venueName} onChange={(e) => setVenueName(e.target.value)} className={fieldStyle} />
              </Field>
              <Field label="Address line 1">
                <input required value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={fieldStyle} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <input required value={city} onChange={(e) => setCity(e.target.value)} className={fieldStyle} />
                </Field>
                <Field label="Postal code">
                  <input required value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={fieldStyle} />
                </Field>
                <Field label="Country">
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={fieldStyle}>
                    <option value="GB">GB</option>
                    <option value="IE">IE</option>
                    <option value="US">US</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {saved && !error && <p className="text-sm text-ink-600">Saved.</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={pending}
              className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
              {pending ? 'Saving…' : 'Save changes'}
            </button>
            <Link href={`/organizer/organizations/${orgId}` as Route}
              className="rounded-md border border-ink-200 px-5 py-2.5 font-medium text-ink-800 hover:bg-ink-100">
              Done
            </Link>
          </div>
        </form>
      </fieldset>

      <hr className="my-10 border-ink-100" />

      <TicketTypesEditor eventId={eventId} disabled={cancelled} />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

const fieldStyle =
  'mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

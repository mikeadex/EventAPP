'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { Route } from 'next';
import { apiClient, ApiError } from '@/lib/api-client';
import { ImageUpload } from '@/components/image-upload';
import { LocationModePicker, type LocationMode } from '@/components/location-mode-picker';

const CATEGORIES = [
  'service', 'worship', 'prayer', 'youth', 'kids', 'small_group',
  'conference', 'outreach', 'social', 'fundraiser', 'class', 'other',
] as const;

interface CreateResponse {
  id: string;
  slug: string;
}

export default function NewEventPage() {
  const router = useRouter();
  const { orgId } = useParams<{ orgId: string }>();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('service');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [locationMode, setLocationMode] = useState<LocationMode>('in_person');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [venueName, setVenueName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('GB');
  const [capacity, setCapacity] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(publish: boolean) {
    setPending(true);
    setError(null);
    try {
      const created = await apiClient<CreateResponse>(
        `/v1/organizations/${orgId}/events`,
        {
          method: 'POST',
          body: {
            title,
            summary: summary || undefined,
            description: description || undefined,
            category,
            startsAt: new Date(startsAt).toISOString(),
            endsAt: new Date(endsAt).toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            isOnline: locationMode !== 'in_person',
            onlineUrl: locationMode === 'in_person' ? undefined : onlineUrl,
            capacity: capacity ? Number(capacity) : undefined,
            coverImageUrl: coverImageUrl ?? undefined,
            venue: locationMode === 'online'
              ? undefined
              : {
                  name: venueName,
                  addressLine1,
                  city,
                  postalCode,
                  country,
                },
          },
        },
      );
      if (publish) {
        await apiClient(`/v1/events/${created.id}/publish`, { method: 'POST' });
      }
      router.push(`/organizer/organizations/${orgId}` as Route);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-ink-900">Create event</h1>
      <p className="mt-1 text-ink-500">
        Draft now, publish whenever you&apos;re ready.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <ImageUpload
          purpose="event_cover"
          value={coverImageUrl}
          onChange={setCoverImageUrl}
          label="Cover image"
          hint="Recommended 1600×700. Shown on event cards and detail page."
        />

        <Field label="Title">
          <input
            required
            minLength={3}
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldStyle}
          />
        </Field>

        <Field label="Short summary" hint="One line. Shown on event cards.">
          <input maxLength={280} value={summary} onChange={(e) => setSummary(e.target.value)} className={fieldStyle} />
        </Field>

        <Field label="Description">
          <textarea
            rows={5}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={fieldStyle}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className={fieldStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacity" hint="Leave blank for no limit.">
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={fieldStyle}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts at">
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={fieldStyle}
            />
          </Field>
          <Field label="Ends at">
            <input
              type="datetime-local"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={fieldStyle}
            />
          </Field>
        </div>

        <LocationModePicker value={locationMode} onChange={setLocationMode} />

        {locationMode !== 'in_person' && (
          <Field label="Stream URL" hint="Where people watch — YouTube, Zoom, whatever you use.">
            <input
              type="url"
              required
              value={onlineUrl}
              onChange={(e) => setOnlineUrl(e.target.value)}
              className={fieldStyle}
            />
          </Field>
        )}

        {locationMode !== 'online' && (
          <div className="rounded-md border border-ink-100 bg-ink-50 p-4 space-y-3">
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

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-ink-200 px-5 py-2.5 font-medium text-ink-800 hover:bg-ink-100 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit(true)}
            className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? 'Publishing…' : 'Save & publish'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
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

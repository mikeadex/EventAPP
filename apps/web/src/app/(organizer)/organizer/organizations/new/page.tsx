'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { apiClient, ApiError } from '@/lib/api-client';
import { ImageUpload } from '@/components/image-upload';

interface OrgResponse {
  id: string;
  slug: string;
  name: string;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [country, setCountry] = useState<'GB' | 'IE' | 'US'>('GB');
  const [currency, setCurrency] = useState<'GBP' | 'EUR' | 'USD'>('GBP');
  const [shortDescription, setShortDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const org = await apiClient<OrgResponse>('/v1/organizations', {
        method: 'POST',
        body: {
          name,
          slug,
          country,
          currency,
          shortDescription: shortDescription || undefined,
          websiteUrl: websiteUrl || undefined,
          logoUrl: logoUrl ?? undefined,
          kind: 'church',
        },
      });
      router.push(`/organizer/organizations/${org.id}` as Route);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl text-ink-900">Register your church</h1>
      <p className="mt-1 text-ink-500">
        Free to start. Verification unlocks public listings, paid events, and payouts.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <ImageUpload
          purpose="org_logo"
          value={logoUrl}
          onChange={setLogoUrl}
          label="Church logo (optional)"
          hint="Square image, at least 256×256."
          shape="square"
          className="max-w-[200px]"
        />

        <Field label="Church or organization name">
          <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldStyle} />
        </Field>
        <Field
          label="URL slug"
          hint="Lowercase letters, numbers, and dashes. Used in /your-slug links."
        >
          <input
            required
            pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={fieldStyle}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Country">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as typeof country)}
              className={fieldStyle}
            >
              <option value="GB">United Kingdom</option>
              <option value="IE">Ireland</option>
              <option value="US">United States</option>
            </select>
          </Field>
          <Field label="Default currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as typeof currency)}
              className={fieldStyle}
            >
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </div>
        <Field label="Short description" hint="One sentence. Shown on church profile.">
          <input
            maxLength={280}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className={fieldStyle}
          />
        </Field>
        <Field label="Website (optional)">
          <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={fieldStyle} />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create church'}
        </button>
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

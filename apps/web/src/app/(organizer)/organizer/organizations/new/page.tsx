'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Field, Segmented } from '@/components/controls';
import { Icon } from '@/components/icons';
import { ImageUpload } from '@/components/image-upload';
import { StepHeader } from '@/components/host/steps';
import { apiClient, ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';

type Kind = 'church' | 'ministry' | 'community';
type Country = 'GB' | 'IE' | 'US';

// The three launch markets the API accepts (SUPPORTED_COUNTRIES); currency
// follows the country so hosts aren't asked a question with one sensible answer.
const COUNTRIES: { value: Country; label: string; currency: 'GBP' | 'EUR' | 'USD' }[] = [
  { value: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { value: 'IE', label: 'Ireland', currency: 'EUR' },
  { value: 'US', label: 'United States', currency: 'USD' },
];

const STEPS = ['Your organisation', 'Your page', 'Verification'];
const SHORT_MAX = 240;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export default function BecomeHostPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);

  const [kind, setKind] = useState<Kind>('church');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [country, setCountry] = useState<Country>('GB');

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [shortDescription, setShortDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Prefill the contact with the signed-in person — usually right.
  useEffect(() => {
    if (session?.user) {
      setContactName((v) => v || session.user.name);
      setContactEmail((v) => v || session.user.email);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  // Public lookup by slug: a 404 means it's free. Debounced.
  useEffect(() => {
    if (slug.length < 3 || !SLUG_RE.test(slug)) {
      setSlugState('idle');
      return;
    }
    setSlugState('checking');
    const t = setTimeout(() => {
      apiClient(`/v1/organizations/${slug}`)
        .then(() => setSlugState('taken'))
        .catch((err) => setSlugState(err instanceof ApiError && err.status === 404 ? 'free' : 'idle'));
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  const slugError =
    slug && !SLUG_RE.test(slug)
      ? 'Lowercase letters, numbers and dashes only.'
      : slug && slug.length < 3
        ? 'At least 3 characters.'
        : slugState === 'taken'
          ? 'That address is taken — try another.'
          : null;

  function next(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (step === 0 && (slugError || slugState === 'checking')) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else void create();
  }

  async function create() {
    setPending(true);
    setError(null);
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    try {
      const org = await apiClient<{ id: string }>('/v1/organizations', {
        method: 'POST',
        body: {
          kind,
          name: name.trim(),
          slug,
          country,
          currency: COUNTRIES.find((c) => c.value === country)!.currency,
          logoUrl: logoUrl ?? undefined,
          shortDescription: opt(shortDescription),
          websiteUrl: opt(websiteUrl),
          contactName: opt(contactName),
          contactEmail: opt(contactEmail),
          contactPhone: opt(contactPhone),
          addressLine1: opt(addressLine1),
          city: opt(city),
          postalCode: opt(postalCode),
        },
      });
      router.replace(`/organizer/organizations/${org.id}?welcome=1` as never);
    } catch (err) {
      setPending(false);
      setError(err instanceof ApiError ? err.message : 'We couldn’t create your organisation. Try again.');
      if (err instanceof ApiError && err.status === 409) setStep(0);
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <StepHeader eyebrow="Become a host" steps={STEPS} current={step} />

      <form onSubmit={next} className="card flex flex-col gap-6 p-6 sm:p-8">
        {step === 0 && (
          <>
            <Segmented
              label="What are you setting up?"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'church', label: 'Church' },
                { value: 'ministry', label: 'Ministry' },
                { value: 'community', label: 'Community group' },
              ]}
            />
            <Field label="Name">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="St Mary’s Church"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Your page address"
              error={slugError}
              hint={
                slugState === 'free'
                  ? '✓ Available. This can’t be changed later.'
                  : 'Where people find your events. This can’t be changed later.'
              }
            >
              {(p) => (
                <div className="flex items-center rounded-field border border-line-2 bg-raised focus-within:border-accent">
                  <span className="pl-4 text-[15px] text-faint">ekklesia/</span>
                  <input
                    {...p}
                    className="w-full bg-transparent py-3.5 pr-4 text-[15px] text-ink outline-none"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true);
                      setSlug(e.target.value.toLowerCase());
                    }}
                  />
                </div>
              )}
            </Field>
            <Field label="Country" hint="Sets your currency. Can’t be changed later.">
              {(p) => (
                <select {...p} className="input" value={country} onChange={(e) => setCountry(e.target.value as Country)}>
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label} ({c.currency})
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <ImageUpload
              purpose="org_logo"
              value={logoUrl}
              onChange={setLogoUrl}
              label="Logo (optional)"
              hint="Square, at least 256×256."
              shape="square"
              className="max-w-[180px]"
            />
            <Field
              label="One-line description"
              hint="Shown under your name on your page and event cards."
              aside={
                <span className="text-[12px] text-faint" aria-live="polite">
                  {shortDescription.length}/{SHORT_MAX}
                </span>
              }
            >
              {(p) => (
                <textarea
                  {...p}
                  className="input min-h-[96px]"
                  maxLength={SHORT_MAX}
                  placeholder="A friendly church in the heart of Leeds, meeting every Sunday."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                />
              )}
            </Field>
            <Field label="Website (optional)">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  type="url"
                  placeholder="https://"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              )}
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex gap-3 rounded-2xl border border-line-3 bg-softer p-4 text-[14px] leading-relaxed text-body">
              <Icon name="check" className="mt-0.5 flex-none text-accent" />
              <span>
                You can publish events as soon as you finish. These details let our team confirm you&rsquo;re a
                real organisation — they&rsquo;re never shown publicly. You can skip them and add them later.
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Contact name">
                {(p) => (
                  <input {...p} className="input" autoComplete="name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                )}
              </Field>
              <Field label="Contact email">
                {(p) => (
                  <input
                    {...p}
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label="Phone (optional)">
              {(p) => (
                <input {...p} className="input" type="tel" autoComplete="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              )}
            </Field>
            <Field label="Address">
              {(p) => (
                <input
                  {...p}
                  className="input"
                  autoComplete="address-line1"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Town or city">
                {(p) => (
                  <input {...p} className="input" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
                )}
              </Field>
              <Field label="Postcode">
                {(p) => (
                  <input {...p} className="input" autoComplete="postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                )}
              </Field>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}

        <div className="rule-x" />
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              <Icon name="arrowLeft" size={16} /> Back
            </button>
          ) : (
            <Link href="/organizer" className="btn btn-ghost">
              Cancel
            </Link>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {step < STEPS.length - 1 ? 'Continue' : pending ? 'Creating…' : 'Create and go to dashboard'}
          </button>
        </div>
      </form>
    </div>
  );
}

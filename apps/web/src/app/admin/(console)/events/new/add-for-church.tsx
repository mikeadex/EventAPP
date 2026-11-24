'use client';

import type { AdminChurchInput } from '@ekklesia/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdminMe } from '@/components/admin/admin-me';
import { Field } from '@/components/controls';
import {
  BasicsFields,
  CapacityField,
  EventPreview,
  TicketKind,
  WhenWhereFields,
  draftToPayload,
  emptyDraft,
  validateDraft,
  type EventDraft,
} from '@/components/host/event-form';
import { PressedChips, StepTabs } from '@/components/host/steps';
import { Icon } from '@/components/icons';
import { adminApi, canModerate, errorCode } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { ClaimPill, NoticeLine, useHostActions, type ClaimStatus } from '../../hosts/host-shared';

/*
 * Mirrors of ADMIN_HOST_COUNTRIES and OrgKind in packages/shared/src/schemas
 * (admin.ts, organization.ts). The web can't import runtime values from
 * @ekklesia/shared in dev, so keep these in step by hand.
 */
const COUNTRIES = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IE', label: 'Ireland' },
  { value: 'US', label: 'United States' },
] as const satisfies readonly { value: AdminChurchInput['country']; label: string }[];
const KINDS = [
  { value: 'church', label: 'Church' },
  { value: 'ministry', label: 'Ministry' },
  { value: 'community', label: 'Community' },
] as const satisfies readonly { value: AdminChurchInput['kind']; label: string }[];

type Country = AdminChurchInput['country'];
type Kind = AdminChurchInput['kind'];

/** A light check before sending; the API validates again (AdminChurchSchema). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ChurchDraft {
  name: string;
  kind: Kind;
  city: string;
  country: Country;
  contactName: string;
  contactEmail: string;
}
type ChurchErrors = Partial<Record<keyof ChurchDraft, string>>;

const emptyChurch = (): ChurchDraft => ({
  name: '',
  kind: 'church',
  city: '',
  country: 'GB',
  contactName: '',
  contactEmail: '',
});

function validateChurch(c: ChurchDraft): ChurchErrors {
  const errs: ChurchErrors = {};
  if (c.name.trim().length < 2) errs.name = 'Add the church’s name (at least 2 characters).';
  if (!c.city.trim()) errs.city = 'Add the area or city.';
  if (!c.contactName.trim()) errs.contactName = 'Add who the claim email is for.';
  const email = c.contactEmail.trim();
  if (!EMAIL.test(email) || email.length > 254) errs.contactEmail = 'Enter a valid email address.';
  return errs;
}

/** An existing host: from `GET /v1/admin/hosts/:id` (only the fields used here). */
interface PickedHost {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  claimStatus: ClaimStatus;
  contactEmail: string | null;
}

/** `GET /v1/admin/hosts/match` and `GET /v1/admin/hosts` rows (fields used here). */
interface HostHit {
  id: string;
  name: string;
  slug: string;
  claimStatus: ClaimStatus;
  city?: string | null;
}

type HostLoad = { state: 'none' } | { state: 'loading' } | { state: 'ok'; host: PickedHost } | { state: 'error'; missing: boolean };

interface Created {
  hostId: string;
  hostSlug: string;
  hostName: string;
  eventSlug: string;
  eventTitle: string;
  /** null: an event for an existing church, which sends no email. */
  inviteSent: boolean | null;
  contactEmail: string | null;
}

/** Waits `ms` after the last change of `value`. */
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Which event-draft field an API issue path (`event.venue.city`, `title`…) belongs to. */
function draftFieldFor(path: string): keyof EventDraft | null {
  const p = path === 'event' ? '' : path.replace(/^event\./, '');
  if (p === 'title' || p === 'summary' || p === 'description' || p === 'capacity' || p === 'onlineUrl') return p;
  if (p === 'startsAt' || p === 'endsAt' || p === '') return 'date';
  if (p === 'venue.name') return 'venueName';
  if (p === 'venue.city') return 'city';
  if (p === 'venue.addressLine1') return 'addressLine1';
  if (p === 'venue.postalCode') return 'postalCode';
  if (p === 'coverImageUrl') return 'coverImageUrl';
  return null;
}

const ISSUE_FALLBACK = 'Check this field.';

export function AddForChurch() {
  const me = useAdminMe();
  if (!canModerate(me.platformRole)) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <div className="card flex flex-col items-start gap-4 p-6" role="alert">
          <p className="text-[15px] text-body">
            Only moderators and super admins can add churches and events. Your role can view hosts and events but not
            change them.
          </p>
          <Link href="/admin/hosts" className="btn btn-outline btn-sm">
            Back to hosts
          </Link>
        </div>
      </div>
    );
  }
  return <AddForm />;
}

function Header() {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
        <Link href="/admin/events" className="text-accent">
          Events
        </Link>{' '}
        / <span aria-current="page">Add event for a church</span>
      </nav>
      <h1 className="h1 !text-[40px]">Add event for a church</h1>
      <p className="text-[15px] text-ink-2">
        It goes live straight away. A new church gets an email with a link to claim its page.
      </p>
    </div>
  );
}

function AddForm() {
  const router = useRouter();
  const search = useSearchParams();
  const hostId = search.get('hostId');

  const [step, setStep] = useState(hostId ? 1 : 0);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [church, setChurch] = useState<ChurchDraft>(emptyChurch);
  const [churchServerErrors, setChurchServerErrors] = useState<ChurchErrors>({});
  const [d, setD] = useState<EventDraft>(() => emptyDraft('GB'));
  const [eventServerErrors, setEventServerErrors] = useState<Partial<Record<keyof EventDraft, string>>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [hostLoad, setHostLoad] = useState<HostLoad>(hostId ? { state: 'loading' } : { state: 'none' });

  const loadHost = useCallback(async (id: string) => {
    setHostLoad({ state: 'loading' });
    try {
      const host = await adminApi<PickedHost>(`/hosts/${id}`);
      setHostLoad({ state: 'ok', host });
      // Venue defaults follow the church.
      setD((p) => ({
        ...p,
        country: COUNTRIES.some((c) => c.value === host.country) ? (host.country as Country) : p.country,
        city: p.city || host.city || '',
      }));
    } catch (e) {
      setHostLoad({ state: 'error', missing: e instanceof ApiError && e.status === 404 });
    }
  }, []);

  useEffect(() => {
    if (hostId) {
      void loadHost(hostId);
      setStep(1);
    } else {
      setHostLoad({ state: 'none' });
      setStep(0);
    }
    setError(null);
  }, [hostId, loadHost]);

  const setC = <K extends keyof ChurchDraft>(k: K, v: ChurchDraft[K]) => {
    setChurch((p) => ({ ...p, [k]: v }));
    setChurchServerErrors((p) => ({ ...p, [k]: undefined }));
    // The venue's country follows the church's until the event step.
    if (k === 'country') setD((p) => ({ ...p, country: v as string }));
  };
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setEventServerErrors((p) => ({ ...p, [k]: undefined }));
  };

  const churchErrors = validateChurch(church);
  const eventErrors = validateDraft(d);
  const visibleChurchErrors: ChurchErrors = { ...(showErrors ? churchErrors : {}), ...stripEmpty(churchServerErrors) };
  const visibleEventErrors = { ...(showErrors ? eventErrors : {}), ...stripEmpty(eventServerErrors) };

  const existing = hostId !== null;
  const host = hostLoad.state === 'ok' ? hostLoad.host : null;
  const hostBlocked = existing && (!host || host.claimStatus !== 'UNCLAIMED');
  const churchReady = existing ? !hostBlocked : Object.keys(churchErrors).length === 0;

  function go(i: number) {
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function pickHost(id: string | null) {
    const q = id ? `?hostId=${encodeURIComponent(id)}` : '';
    router.replace(`/admin/events/new${q}` as never, { scroll: false });
  }

  function toEventStep(e?: FormEvent) {
    e?.preventDefault();
    if (!churchReady) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (!existing && !d.city) setD((p) => ({ ...p, city: church.city.trim() }));
    go(1);
  }

  function applyIssues(issues: { path: string; message: string }[]) {
    const cErrs: ChurchErrors = {};
    const eErrs: Partial<Record<keyof EventDraft, string>> = {};
    const other: string[] = [];
    for (const i of issues) {
      if (i.path.startsWith('church.')) {
        const k = i.path.slice('church.'.length) as keyof ChurchDraft;
        if (k in church) cErrs[k] = i.message || ISSUE_FALLBACK;
        else other.push(i.message);
        continue;
      }
      const f = draftFieldFor(i.path);
      if (f) eErrs[f] = i.message || ISSUE_FALLBACK;
      else other.push(i.message);
    }
    setChurchServerErrors(cErrs);
    setEventServerErrors(eErrs);
    if (Object.keys(cErrs).length) setStep(0);
    setError(
      other.length
        ? `Check the form: ${other.join(' ')}`
        : 'Some details need fixing — they’re marked on the form.',
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!churchReady) {
      setShowErrors(true);
      go(0);
      return;
    }
    if (Object.keys(eventErrors).length) {
      setShowErrors(true);
      return;
    }
    setPending(true);
    setError(null);
    setChurchServerErrors({});
    setEventServerErrors({});
    // No ticket types: the event is free (an unclaimed church may only have
    // free events; the API refuses anything priced with FREE_ONLY).
    const event = { ...draftToPayload(d, false), visibility: 'public' as const, ticketTypes: [] };
    try {
      if (existing && host) {
        const r = await adminApi<{ event: { id: string; slug: string } }>(`/hosts/${host.id}/events`, {
          method: 'POST',
          body: event,
        });
        setCreated({
          hostId: host.id,
          hostSlug: host.slug,
          hostName: host.name,
          eventSlug: r.event.slug,
          eventTitle: event.title,
          inviteSent: null,
          contactEmail: host.contactEmail,
        });
      } else {
        const body = {
          church: {
            name: church.name.trim(),
            kind: church.kind,
            city: church.city.trim(),
            country: church.country,
            contactName: church.contactName.trim(),
            contactEmail: church.contactEmail.trim().toLowerCase(),
          } satisfies AdminChurchInput,
          event,
        };
        const r = await adminApi<{ host: { id: string; slug: string }; event: { id: string; slug: string }; inviteSent: boolean }>(
          '/hosts',
          { method: 'POST', body },
        );
        setCreated({
          hostId: r.host.id,
          hostSlug: r.host.slug,
          hostName: body.church.name,
          eventSlug: r.event.slug,
          eventTitle: event.title,
          inviteSent: r.inviteSent,
          contactEmail: body.church.contactEmail,
        });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const code = errorCode(err);
      const payload = err instanceof ApiError ? err.payload : null;
      const issues =
        payload && typeof payload === 'object' && 'issues' in payload && Array.isArray((payload as { issues: unknown }).issues)
          ? ((payload as { issues: { path: string; message: string }[] }).issues ?? [])
          : null;
      if (issues && issues.length) {
        applyIssues(issues);
      } else if (code === 'FREE_ONLY') {
        setError('Churches added by Ekklesia can only have free events until they claim their page.');
      } else if (code === 'SLUG_TAKEN') {
        setChurchServerErrors({ name: 'A church page with this web address already exists. Try a fuller name.' });
        setError('That name clashes with an existing church page.');
        setStep(0);
      } else if (code === 'NOT_UNCLAIMED') {
        setError('This church has been claimed or taken down since you opened the page, so staff can’t add events to it.');
        if (hostId) void loadHost(hostId);
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Your role can’t add churches or events.');
      } else {
        setError(err instanceof ApiError && err.message ? err.message : 'We couldn’t save this. Try again.');
      }
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <Success
          created={created}
          onAnother={() => {
            setCreated(null);
            setD(emptyDraft(d.country));
            setShowErrors(false);
            if (hostId === created.hostId) {
              void loadHost(created.hostId);
              go(1);
            } else {
              pickHost(created.hostId);
            }
          }}
        />
      </div>
    );
  }

  const previewHost = host?.name ?? (church.name.trim() || 'The church');

  return (
    <div className="flex flex-col gap-6">
      <Header />

      <div className="adm-steps">
        <StepTabs steps={['Church', 'Event']} current={hostBlocked ? 0 : step} onSelect={(i) => (i === 1 ? toEventStep() : go(0))} />
      </div>

      {step === 0 || hostBlocked ? (
        existing ? (
          <ExistingHostCard load={hostLoad} onChange={() => pickHost(null)} onRetry={() => hostId && void loadHost(hostId)} />
        ) : (
          <form onSubmit={toEventStep} className="card flex min-w-0 flex-col gap-6 p-6 sm:p-8" noValidate>
            <PressedChips
              legend="Add the event to"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'new', label: 'A new church' },
                { value: 'existing', label: 'An unclaimed church' },
              ]}
            />
            {mode === 'existing' ? (
              <UnclaimedSearch onPick={(id) => pickHost(id)} />
            ) : (
              <>
                <NewChurchFields c={church} set={setC} errors={visibleChurchErrors} />
                <MatchCards name={church.name} email={church.contactEmail} onPick={(id) => pickHost(id)} />
                <div className="rule-x mt-1" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href="/admin/events" className="btn btn-lg text-ink-2 hover:text-ink">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary btn-lg">
                    Continue to event
                  </button>
                </div>
              </>
            )}
          </form>
        )
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={(e) => void submit(e)} className="card flex min-w-0 flex-col gap-6 p-6 sm:p-8" noValidate>
            {existing ? (
              <ExistingHostCard
                load={hostLoad}
                compact
                onChange={() => pickHost(null)}
                onRetry={() => hostId && void loadHost(hostId)}
              />
            ) : (
              <p className="text-[14px] text-muted">
                For <span className="text-strong">{church.name.trim()}</span> · claim email to{' '}
                <span className="[overflow-wrap:anywhere]">{church.contactEmail.trim().toLowerCase()}</span>
              </p>
            )}
            <BasicsFields d={d} set={set} errors={visibleEventErrors} />
            <WhenWhereFields d={d} set={set} errors={visibleEventErrors} />
            <TicketKind freeOnly />
            <CapacityField d={d} set={set} errors={visibleEventErrors} />

            {error ? (
              <p role="alert" className="error-text">
                {error}
              </p>
            ) : null}

            <div className="rule-x mt-1" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {existing ? (
                <Link href={`/admin/hosts/${hostId}` as never} className="btn btn-lg text-ink-2 hover:text-ink">
                  Cancel
                </Link>
              ) : (
                <button type="button" className="btn btn-outline btn-lg" onClick={() => go(0)}>
                  Back
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={pending}
                aria-busy={pending || undefined}
              >
                {pending ? 'Publishing…' : existing ? 'Publish event' : 'Publish and send claim email'}
              </button>
            </div>
          </form>
          <aside className="xl:sticky xl:top-24">
            <EventPreview d={d} host={previewHost} />
          </aside>
        </div>
      )}
      {(step === 0 || hostBlocked) && error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function stripEmpty<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as T;
}

function NewChurchFields({
  c,
  set,
  errors,
}: {
  c: ChurchDraft;
  set: <K extends keyof ChurchDraft>(k: K, v: ChurchDraft[K]) => void;
  errors: ChurchErrors;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Field label="Church name" error={errors.name}>
        {(p) => (
          <input
            {...p}
            className="input"
            required
            maxLength={120}
            autoComplete="off"
            placeholder="Grace Light Church"
            value={c.name}
            onChange={(e) => set('name', e.target.value)}
          />
        )}
      </Field>
      <PressedChips legend="Type" value={c.kind} onChange={(v) => set('kind', v)} options={[...KINDS]} />
      <Field label="Area or city" error={errors.city}>
        {(p) => (
          <input
            {...p}
            className="input"
            required
            maxLength={120}
            autoComplete="off"
            value={c.city}
            onChange={(e) => set('city', e.target.value)}
          />
        )}
      </Field>
      <PressedChips
        legend="Country"
        value={c.country}
        onChange={(v) => set('country', v)}
        options={[...COUNTRIES]}
        hint="Sets the church’s currency. Ekklesia is open in these three for now."
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Contact name" error={errors.contactName}>
          {(p) => (
            <input
              {...p}
              className="input"
              required
              maxLength={120}
              autoComplete="off"
              value={c.contactName}
              onChange={(e) => set('contactName', e.target.value)}
            />
          )}
        </Field>
        <Field label="Contact email" hint="The claim email goes here." error={errors.contactEmail}>
          {(p) => (
            <input
              {...p}
              className="input"
              type="email"
              inputMode="email"
              required
              maxLength={254}
              autoComplete="off"
              value={c.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/** "Possible match" cards from `GET hosts/match`, as the name and email are typed. */
function MatchCards({ name, email, onPick }: { name: string; email: string; onPick: (id: string) => void }) {
  const q = useDebounced({ name: name.trim(), email: email.trim().toLowerCase() }, 400);
  const [hits, setHits] = useState<HostHit[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.name.length >= 2) params.set('name', q.name);
    if (EMAIL.test(q.email)) params.set('email', q.email);
    if (!params.toString()) {
      setHits([]);
      return;
    }
    let live = true;
    adminApi<{ items: HostHit[] }>(`/hosts/match?${params}`)
      .then((r) => live && setHits(r.items))
      // A failed lookup only loses a warning; the form still works.
      .catch(() => live && setHits([]));
    return () => {
      live = false;
    };
  }, [q.name, q.email]);

  return (
    <div role="status" aria-live="polite" className={hits.length ? 'flex flex-col gap-3' : 'sr-only'}>
      {hits.length ? (
        <>
          <span className="flex items-center gap-2 text-[14px] text-body">
            <Icon name="alert" size={18} className="flex-none text-[var(--warn)]" />
            {hits.length === 1 ? 'Possible match — check it isn’t already on Ekklesia' : `${hits.length} possible matches — check they aren’t already on Ekklesia`}
          </span>
          <ul className="flex flex-col gap-2">
            {hits.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line px-4 py-3">
                <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
                  <Link href={`/admin/hosts/${h.id}` as never} className="text-[15px] text-strong hover:text-accent [overflow-wrap:anywhere]">
                    {h.name}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                    <ClaimPill status={h.claimStatus} />
                    <span className="mono">/{h.slug}</span>
                  </span>
                </span>
                {h.claimStatus === 'UNCLAIMED' ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => onPick(h.id)}>
                    Add event to this church instead
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Search unclaimed churches (`GET hosts?status=unclaimed&q=`) and pick one. */
function UnclaimedSearch({ onPick }: { onPick: (id: string) => void }) {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);
  const [res, setRes] = useState<{ state: 'loading' } | { state: 'ok'; items: HostHit[] } | { state: 'error' }>({
    state: 'loading',
  });

  useEffect(() => {
    let live = true;
    setRes({ state: 'loading' });
    const params = new URLSearchParams({ status: 'unclaimed' });
    if (q) params.set('q', q);
    adminApi<{ items: HostHit[] }>(`/hosts?${params}`)
      .then((r) => live && setRes({ state: 'ok', items: r.items.slice(0, 8) }))
      .catch(() => live && setRes({ state: 'error' }));
    return () => {
      live = false;
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <label className="field !h-11 !px-4">
        <Icon name="search" className="flex-none text-muted" />
        <span className="sr-only">Search unclaimed churches</span>
        <input
          type="search"
          placeholder="Name, city or contact email"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="!text-[15px]"
        />
      </label>
      <div role="status" aria-live="polite">
        {res.state === 'loading' ? (
          <p className="text-[14px] text-muted">Searching…</p>
        ) : res.state === 'error' ? (
          <p className="text-[14px] text-muted">We couldn’t search churches. Try again.</p>
        ) : res.items.length === 0 ? (
          <p className="text-[14px] text-muted">No unclaimed churches match. Add it as a new church instead.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Unclaimed churches">
            {res.items.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onPick(h.id)}
                  className="flex min-h-[44px] w-full flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line px-4 py-3 text-left hover:border-line-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] text-strong [overflow-wrap:anywhere]">{h.name}</span>
                    <span className="text-[13px] text-muted">{[h.city, `/${h.slug}`].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="text-[14px] text-accent">Add event here</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The preselected church (?hostId=): its name and claim pill, or why staff can't add here. */
function ExistingHostCard({
  load,
  compact = false,
  onChange,
  onRetry,
}: {
  load: HostLoad;
  compact?: boolean;
  onChange: () => void;
  onRetry: () => void;
}) {
  const box = compact ? 'flex flex-wrap items-center gap-3' : 'card flex flex-wrap items-center gap-3 p-6';
  if (load.state === 'loading' || load.state === 'none') {
    return (
      <p className={`${box} text-[14px] text-muted`} role="status">
        Loading church…
      </p>
    );
  }
  if (load.state === 'error') {
    return (
      <div className={box} role="alert">
        <p className="flex-1 text-[14px] text-body">
          {load.missing ? 'This church doesn’t exist, or it has been removed.' : 'We couldn’t load this church.'}
        </p>
        {!load.missing ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <button type="button" className="btn btn-outline btn-sm" onClick={onChange}>
          Choose another church
        </button>
      </div>
    );
  }
  const h = load.host;
  const why =
    h.claimStatus === 'CLAIMED'
      ? 'This church has claimed its page, so its own team adds events now. Staff can only add events for unclaimed churches.'
      : h.claimStatus === 'DISPUTED'
        ? 'This church was taken down by its contact. Restore it from its profile before adding events.'
        : null;
  return (
    <div className={`${compact ? '' : 'card p-6'} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
          <span className="text-[13px] text-muted">Adding to</span>
          <span className="flex flex-wrap items-center gap-2.5">
            <Link href={`/admin/hosts/${h.id}` as never} className="text-[18px] text-strong hover:text-accent [overflow-wrap:anywhere]">
              {h.name}
            </Link>
            <ClaimPill status={h.claimStatus} />
          </span>
        </span>
        <button type="button" className="btn btn-outline btn-sm" onClick={onChange}>
          Change church
        </button>
      </div>
      {why ? (
        <p role="alert" className="text-[14px] leading-relaxed text-body">
          <span aria-hidden="true" className="text-[var(--warn)]">
            !{' '}
          </span>
          {why}
        </p>
      ) : null}
    </div>
  );
}

function Success({ created, onAnother }: { created: Created; onAnother: () => void }) {
  const { busy, notice, resend } = useHostActions(created.hostId, () => {});
  const publicPath = `/${created.hostSlug}/${created.eventSlug}`;
  return (
    <section className="card flex flex-col gap-5 p-6 sm:p-8" aria-labelledby="h-live">
      <span className="eyebrow inline-flex items-center gap-2 text-accent">
        <Icon name="check" size={16} />
        Live now
      </span>
      <h2 id="h-live" className="text-[26px] leading-tight text-strong [overflow-wrap:anywhere]">
        {created.eventTitle}
      </h2>
      <p className="text-[15px] leading-relaxed text-body">
        {created.inviteSent === null
          ? `Published on ${created.hostName}’s page.`
          : `${created.hostName} is on Ekklesia as an unclaimed church, and this event is published.`}
      </p>

      <div className="kv">
        <span>Public page</span>
        <Link href={publicPath as never} target="_blank" className="mono text-[13px] text-accent [overflow-wrap:anywhere]">
          {publicPath} ↗
        </Link>
      </div>

      {created.inviteSent === true ? (
        <NoticeLine notice={notice ?? { tone: 'ok', text: `Claim email sent to ${created.contactEmail}.` }} />
      ) : created.inviteSent === false && notice?.tone === 'ok' ? (
        <NoticeLine notice={notice} />
      ) : created.inviteSent === false ? (
        <div className="alert">
          <Icon name="alert" size={20} className="flex-none text-accent" />
          <span className="flex min-w-[220px] flex-1 flex-col gap-0.5">
            <span className="text-[15px] text-strong">The page is live, but the claim email didn’t send</span>
            <span role="status" className="text-[13px] text-ink-2">
              {notice ? notice.text : `Try again to send it to ${created.contactEmail}.`}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy !== null}
            aria-busy={busy === 'resend' || undefined}
            onClick={() => void resend(created.contactEmail)}
          >
            {busy === 'resend' ? 'Sending…' : 'Resend'}
          </button>
        </div>
      ) : (
        <p className="text-[14px] text-muted">
          No new claim email: the church already has one. You can resend it from the church’s profile.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Link href={`/admin/hosts/${created.hostId}` as never} className="btn btn-outline">
          Church profile
        </Link>
        <button type="button" className="btn btn-outline" onClick={onAnother}>
          <Icon name="plus" size={16} />
          Add another event for this church
        </button>
      </div>
    </section>
  );
}

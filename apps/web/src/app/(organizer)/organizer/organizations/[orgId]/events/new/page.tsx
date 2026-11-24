'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Segmented } from '@/components/controls';
import {
  BasicsFields,
  CapacityField,
  EventPreview,
  WhenWhereFields,
  draftTimes,
  draftToPayload,
  emptyDraft,
  validateDraft,
  type EventDraft,
} from '@/components/host/event-form';
import { StepHeader } from '@/components/host/steps';
import { Icon } from '@/components/icons';
import { Row } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { categoryOf } from '@/lib/categories';
import { fmtDateLong, fmtTime } from '@/lib/format';
import { useMe } from '@/lib/use-api';

const STEPS = ['The basics', 'When and where', 'Places and publishing'];

/** Which fields each step owns, so errors send people back to the right one. */
const STEP_FIELDS: (keyof EventDraft)[][] = [
  ['title', 'category', 'summary', 'description', 'coverImageUrl'],
  ['date', 'start', 'end', 'onlineUrl', 'venueName', 'city'],
  ['capacity'],
];

export default function NewEventPage() {
  const router = useRouter();
  const { orgId } = useParams<{ orgId: string }>();
  const me = useMe();
  const host = me.data?.memberships.find((m) => m.organizationId === orgId)?.name ?? 'Your organisation';

  const [step, setStep] = useState(0);
  const [d, setD] = useState<EventDraft>(() => emptyDraft());
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'draft' | 'publish' | null>(null);

  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const errors = validateDraft(d);
  const stepErrors = (i: number) => STEP_FIELDS[i]!.filter((f) => errors[f]);
  const visibleErrors = showErrors ? errors : {};

  function next(e: FormEvent) {
    e.preventDefault();
    if (stepErrors(step).length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(publish: boolean) {
    const firstBad = STEP_FIELDS.findIndex((_, i) => stepErrors(i).length > 0);
    if (firstBad !== -1) {
      setShowErrors(true);
      setStep(firstBad);
      return;
    }
    setPending(publish ? 'publish' : 'draft');
    setError(null);
    try {
      // No ticket types: the API takes free RSVPs against a default place
      // type it creates on the first booking.
      const created = await apiClient<{ id: string }>(`/v1/organizations/${orgId}/events`, {
        method: 'POST',
        body: { ...draftToPayload(d, false), visibility },
      });
      if (publish) {
        try {
          await apiClient(`/v1/events/${created.id}/publish`, { method: 'POST' });
        } catch (err) {
          // Saved but not live: take them to the editor to sort it out.
          router.replace(`/organizer/organizations/${orgId}/events/${created.id}/edit?publishError=1` as never);
          throw err;
        }
      }
      router.replace(`/organizer/organizations/${orgId}` as never);
    } catch (err) {
      setPending(null);
      setError(err instanceof ApiError ? err.message : 'We couldn’t save your event. Try again.');
    }
  }

  const t = draftTimes(d);

  return (
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <StepHeader eyebrow="New event" steps={STEPS} current={step} />
        <form onSubmit={next} className="card flex flex-col gap-6 p-6 sm:p-8" noValidate>
          {step === 0 && <BasicsFields d={d} set={set} errors={visibleErrors} />}
          {step === 1 && <WhenWhereFields d={d} set={set} errors={visibleErrors} />}
          {step === 2 && (
            <>
              <div className="flex flex-col gap-3">
                <Segmented
                  label="Tickets"
                  value="free"
                  onChange={() => {}}
                  options={[{ value: 'free', label: 'Free — people reserve a place' }]}
                />
                {/* TODO(confirm): paid tickets. The API only books free places
                    today (RSVP refuses any event with a priced ticket type), so
                    offering "Paid" here would publish an event nobody can book. */}
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                  <Icon name="coins" size={15} className="mt-0.5 flex-none" />
                  Paid tickets aren&rsquo;t available yet. Every place is free to reserve and gets its own QR ticket.
                </p>
              </div>
              <CapacityField d={d} set={set} errors={visibleErrors} />
              <Segmented
                label="Who can find it?"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: 'public', label: 'Public — listed on Discover' },
                  { value: 'unlisted', label: 'Unlisted — only people with the link' },
                ]}
              />
              <div className="panel flex flex-col gap-3 p-5">
                <span className="eyebrow text-[10px] text-faint">Review</span>
                <Row k="Title" v={d.title || '—'} />
                <Row k="Category" v={categoryOf(d.category).label} />
                <Row k="When" v={t ? `${fmtDateLong(t.startsAt.toISOString())}, ${fmtTime(t.startsAt.toISOString())}–${fmtTime(t.endsAt.toISOString())}` : '—'} />
                <Row
                  k="Where"
                  v={
                    d.mode === 'online'
                      ? 'Online'
                      : `${d.venueName || '—'}${d.city ? `, ${d.city}` : ''}${d.mode === 'hybrid' ? ' + online' : ''}`
                  }
                />
                <Row k="Places" v={d.capacity ? `${d.capacity}, free` : 'Unlimited, free'} />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}

          <div className="rule-x" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                <Icon name="arrowLeft" size={16} /> Back
              </button>
            ) : (
              <Link href={`/organizer/organizations/${orgId}` as never} className="btn btn-ghost">
                Cancel
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <button type="submit" className="btn btn-primary btn-lg">
                Continue
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-outline btn-lg" disabled={pending !== null} onClick={() => void save(false)}>
                  {pending === 'draft' ? 'Saving…' : 'Save as draft'}
                </button>
                <button type="button" className="btn btn-primary btn-lg" disabled={pending !== null} onClick={() => void save(true)}>
                  {pending === 'publish' ? 'Publishing…' : 'Publish event'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
      <aside className="hidden xl:sticky xl:top-24 xl:block">
        <EventPreview d={d} host={host} />
      </aside>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  BasicsFields,
  CapacityField,
  EventPreview,
  ReviewList,
  TicketKind,
  VisibilityChips,
  WhenWhereFields,
  draftToPayload,
  emptyDraft,
  validateDraft,
  type EventDraft,
} from '@/components/host/event-form';
import { StepTabs } from '@/components/host/steps';
import { apiClient, ApiError } from '@/lib/api-client';
import { useMe } from '@/lib/use-api';

const STEPS = ['The basics', 'Tickets', 'Review & publish'];

/** Which fields each step owns, so errors send people back to the right one. */
const STEP_FIELDS: (keyof EventDraft)[][] = [
  ['title', 'category', 'summary', 'description', 'coverImageUrl', 'date', 'start', 'end', 'onlineUrl', 'venueName', 'city'],
  ['capacity'],
  [],
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

  function go(i: number) {
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (stepErrors(step).length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    go(Math.min(step + 1, STEPS.length - 1));
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

  return (
    <div className="flex flex-col gap-6">
      {/* "Preview" from the design isn't offered here: the public event page
          only serves published events, so there's nothing to open yet. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="eyebrow text-accent">New event</span>
          <h1 className="text-[34px] leading-[1.1] text-strong [overflow-wrap:anywhere] sm:text-[40px]">
            {d.title.trim() || 'Untitled event'}
          </h1>
        </div>
        <button type="button" className="btn btn-outline" disabled={pending !== null} onClick={() => void save(false)}>
          {pending === 'draft' ? 'Saving…' : 'Save draft'}
        </button>
      </div>

      <StepTabs steps={STEPS} current={step} onSelect={go} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={next} className="card flex min-w-0 flex-col gap-6 p-6 sm:p-8" noValidate>
          {step === 0 && (
            <>
              <BasicsFields d={d} set={set} errors={visibleErrors} />
              <WhenWhereFields d={d} set={set} errors={visibleErrors} />
            </>
          )}
          {step === 1 && (
            <>
              <TicketKind />
              <CapacityField d={d} set={set} errors={visibleErrors} />
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-[22px] text-strong">Ready to publish?</h2>
              <ReviewList d={d} />
              <VisibilityChips value={visibility} onChange={setVisibility} />
            </>
          )}

          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}

          <div className="rule-x mt-1" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {step > 0 ? (
              <button type="button" className="btn btn-outline btn-lg" onClick={() => go(step - 1)}>
                Back
              </button>
            ) : (
              <Link href={`/organizer/organizations/${orgId}` as never} className="btn btn-lg text-ink-2 hover:text-ink">
                Cancel
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <button type="submit" className="btn btn-primary btn-lg">
                {step === 0 ? 'Continue to tickets' : 'Review'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-lg" disabled={pending !== null} onClick={() => void save(true)}>
                {pending === 'publish' ? 'Publishing…' : 'Publish event'}
              </button>
            )}
          </div>
        </form>
        <aside className="xl:sticky xl:top-24">
          <EventPreview d={d} host={host} />
        </aside>
      </div>
    </div>
  );
}

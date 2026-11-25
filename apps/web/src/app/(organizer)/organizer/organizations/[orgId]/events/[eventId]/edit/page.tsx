'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { EventGalleryEditor } from '@/components/event-gallery-editor';
import {
  BasicsFields,
  CapacityField,
  EventPreview,
  ReviewList,
  TicketKind,
  VisibilityChips,
  WhenWhereFields,
  draftFromEvent,
  draftToPayload,
  validateDraft,
  type EventDraft,
} from '@/components/host/event-form';
import { StepTabs } from '@/components/host/steps';
import { Icon } from '@/components/icons';
import { TicketTypesEditor } from '@/components/ticket-types-editor';
import { ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { fmtDay, fmtTime } from '@/lib/format';
import type { OrganizerSeriesDate, SeriesDates, Venue } from '@/lib/types';
import { useMe } from '@/lib/use-api';

interface OrganizerEvent {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
  visibility: 'PUBLIC' | 'UNLISTED' | 'MEMBERS_ONLY';
  startsAt: string;
  endsAt: string;
  isOnline: boolean;
  onlineUrl: string | null;
  capacity: number | null;
  attendeeCount: number;
  coverImageUrl: string | null;
  venue: Venue | null;
  seriesId: string | null;
}

const STEPS = ['The basics', 'Tickets', 'Review & publish'];

/** Which fields each step owns, so a failed save opens the right one. */
const STEP_FIELDS: (keyof EventDraft)[][] = [
  ['title', 'category', 'summary', 'description', 'coverImageUrl', 'date', 'start', 'end', 'onlineUrl', 'venueName', 'city'],
  ['capacity'],
  [],
];

const STATUS_LABEL: Record<OrganizerEvent['status'], string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Live',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Ended',
};

export default function EditEventPage() {
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>();
  const publishError = useSearchParams().get('publishError') === '1';
  const me = useMe();
  const membership = me.data?.memberships.find((m) => m.organizationId === orgId);
  const orgSlug = membership?.slug;
  const [step, setStep] = useState(0);

  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [d, setD] = useState<EventDraft | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [showErrors, setShowErrors] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    publishError ? { ok: false, text: 'Your event was saved as a draft but couldn’t be published. Check the details and try again.' } : null,
  );
  const [pending, setPending] = useState<null | 'save' | 'publish' | 'publishSeries' | 'cancel' | 'cancelSeries'>(null);
  const [confirmCancel, setConfirmCancel] = useState<false | 'one' | 'series'>(false);
  const [series, setSeries] = useState<SeriesDates<OrganizerSeriesDate> | null>(null);

  const hydrate = useCallback((e: OrganizerEvent) => {
    setEvent(e);
    setD(draftFromEvent(e));
    setVisibility(e.visibility === 'UNLISTED' ? 'unlisted' : 'public');
  }, []);

  useEffect(() => {
    apiClient<OrganizerEvent>(`/v1/events/${eventId}`)
      .then(hydrate)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'We couldn’t load this event.'));
  }, [eventId, hydrate]);

  const seriesId = event?.seriesId ?? null;
  useEffect(() => {
    if (!seriesId) return;
    // The other dates are a side panel; failing to load them is not a reason
    // to block editing this one.
    apiClient<SeriesDates<OrganizerSeriesDate>>(`/v1/events/${eventId}/series/dates`)
      .then(setSeries)
      .catch(() => setSeries(null));
  }, [eventId, seriesId, pending]);

  if (loadError) return <ErrorCard message={loadError} />;
  if (!event || !d) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((p) => (p ? { ...p, [k]: v } : p));
  const errors = validateDraft(d);
  const cancelled = event.status === 'CANCELLED';
  const ended = new Date(event.endsAt).getTime() < Date.now();
  const live = event.status === 'PUBLISHED';
  const base = `/organizer/organizations/${orgId}/events/${eventId}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (Object.keys(errors).length) {
      setShowErrors(true);
      const firstBad = STEP_FIELDS.findIndex((fields) => fields.some((f) => errors[f]));
      if (firstBad !== -1) setStep(firstBad);
      setMsg({ ok: false, text: 'Fix the highlighted fields, then save.' });
      return;
    }
    setPending('save');
    setMsg(null);
    try {
      await apiClient(`/v1/events/${eventId}`, {
        method: 'PATCH',
        body: { ...draftToPayload(d!, true), visibility },
      });
      // Refetch so the form shows what was actually stored.
      hydrate(await apiClient<OrganizerEvent>(`/v1/events/${eventId}`));
      setShowErrors(false);
      setMsg({ ok: true, text: 'Changes saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'We couldn’t save your changes.' });
    } finally {
      setPending(null);
    }
  }

  async function transition(action: 'publish' | 'publishSeries' | 'cancel' | 'cancelSeries') {
    setPending(action);
    setMsg(null);
    try {
      const path =
        action === 'cancelSeries' ? 'series/cancel' : action === 'publishSeries' ? 'publish' : action;
      const result = await apiClient<{ publishedCount?: number; cancelled?: number }>(`/v1/events/${eventId}/${path}`, {
        method: 'POST',
        body: action === 'publishSeries' ? { applyToSeries: true } : {},
      });
      hydrate(await apiClient<OrganizerEvent>(`/v1/events/${eventId}`));
      setConfirmCancel(false);
      setMsg({
        ok: true,
        text:
          action === 'publish'
            ? 'Your event is live.'
            : action === 'publishSeries'
              ? `${result.publishedCount ?? ''} dates are live.`.trim()
              : action === 'cancelSeries'
                ? `${result.cancelled ?? ''} dates cancelled.`.trim()
                : 'Event cancelled.',
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Something went wrong.' });
    } finally {
      setPending(null);
    }
  }

  const visibleErrors = showErrors ? errors : {};
  const otherDates = series?.items.filter((o) => o.id !== eventId) ?? [];
  const otherDrafts = otherDates.filter((o) => (o.status === 'DRAFT' || o.status === 'SCHEDULED') && new Date(o.endsAt).getTime() > Date.now()).length;
  const laterLive = otherDates.filter((o) => o.status === 'PUBLISHED' && o.startsAt > event.startsAt).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="flex flex-wrap items-center gap-3">
            <span className="eyebrow text-accent">Edit event</span>
            <span className={live && !ended ? 'tag' : 'tag-muted'}>{ended && !cancelled ? 'Ended' : STATUS_LABEL[event.status]}</span>
            <span className="text-[13px] text-muted">{event.attendeeCount} going</span>
          </span>
          <h1 className="text-[34px] leading-[1.1] text-strong [overflow-wrap:anywhere] sm:text-[40px]">
            {d.title.trim() || event.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {live && orgSlug && (
            <Link href={`/${orgSlug}/${event.slug}` as never} target="_blank" className="btn btn-outline">
              <Icon name="external" size={16} /> View live
            </Link>
          )}
          <Link href={`${base}/attendees` as never} className="btn btn-outline">
            Attendees
          </Link>
          {(event.status === 'DRAFT' || event.status === 'SCHEDULED') && !ended && (
            <>
              {otherDrafts > 0 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={pending !== null}
                  onClick={() => void transition('publishSeries')}
                >
                  {pending === 'publishSeries' ? 'Publishing…' : `Publish all ${otherDrafts + 1} dates`}
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={pending !== null} onClick={() => void transition('publish')}>
                {pending === 'publish' ? 'Publishing…' : otherDrafts > 0 ? 'Publish this date' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </div>

      <StepTabs steps={STEPS} current={step} onSelect={setStep} />

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`panel p-4 text-[14px] ${msg.ok ? 'text-ink-2' : 'text-accent'}`}>
          {msg.text}
        </p>
      )}
      {cancelled && (
        <p className="panel p-4 text-[14px] text-body">This event is cancelled and can no longer be edited.</p>
      )}
      {event.seriesId && (
        <section aria-labelledby="series-h" className="panel flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="series-h" className="flex items-center gap-2 text-[16px] text-strong">
              <Icon name="calendar" size={16} className="text-accent" /> Part of a series
            </h2>
            <span className="text-[13px] text-muted">
              {series
                ? `${series.rule === 'WEEKLY' ? 'Weekly' : 'Monthly'} · ${series.items.length} dates. Changes here apply to this date only.`
                : 'Changes here apply to this date only.'}
            </span>
          </div>
          {otherDates.length > 0 && (
            <ol className="flex flex-wrap gap-2" aria-label="Other dates in this series">
              {otherDates.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/organizer/organizations/${orgId}/events/${o.id}/edit` as never}
                    className={`chip ${o.status === 'CANCELLED' ? 'line-through' : ''}`}
                    aria-label={`${fmtDay(o.startsAt, o.timezone)} at ${fmtTime(o.startsAt, o.timezone)}, ${STATUS_LABEL[o.status].toLowerCase()}`}
                  >
                    {fmtDay(o.startsAt, o.timezone)}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <form onSubmit={save} noValidate>
            <fieldset disabled={cancelled} className="flex flex-col gap-6">
              <section className="card flex flex-col gap-6 p-6 sm:p-8">
                {step === 0 && (
                  <>
                    <BasicsFields d={d} set={set} errors={visibleErrors} />
                    <WhenWhereFields d={d} set={set} errors={visibleErrors} disabled={cancelled} />
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
                    <h2 className="text-[22px] text-strong">{live ? 'Live on Ekklesia' : 'Ready to publish?'}</h2>
                    <ReviewList d={d} />
                    <VisibilityChips value={visibility} onChange={setVisibility} />
                  </>
                )}
                <div className="rule-x mt-1" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {step > 0 ? (
                    <button type="button" className="btn btn-outline btn-lg" onClick={() => setStep(step - 1)}>
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {step < STEPS.length - 1 && (
                    <button type="button" className="btn btn-outline btn-lg" onClick={() => setStep(step + 1)}>
                      {step === 0 ? 'Continue to tickets' : 'Review'}
                    </button>
                  )}
                </div>
              </section>
              {!cancelled && (
                <div className="glass sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-panel border border-line-2 p-3 pl-5">
                  <span className="text-[13px] text-muted">Changes go live as soon as you save.</span>
                  <button type="submit" className="btn btn-primary" disabled={pending !== null}>
                    {pending === 'save' ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </fieldset>
          </form>

          {step === 0 && (
            <section className="card p-6 sm:p-8">
              {/* onCoverChange keeps the form in step: promoting a gallery image to
                  cover otherwise leaves the field above stale, and the next save
                  would write the old URL back over it. */}
              <EventGalleryEditor eventId={eventId} coverImageUrl={d.coverImageUrl} onCoverChange={(v) => set('coverImageUrl', v)} />
            </section>
          )}

          {step === 1 && (
            <section className="card p-6 sm:p-8">
              <TicketTypesEditor eventId={eventId} disabled={cancelled} />
            </section>
          )}

          {step === 2 && live && !ended && (
            <section className="card flex flex-col gap-4 p-6 sm:p-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-[20px] text-strong">Cancel this event</h2>
                <p className="text-[14px] text-body">
                  Bookings close and the event page shows it as cancelled. This can&rsquo;t be undone.
                </p>
              </div>
              {confirmCancel ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pending !== null}
                    onClick={() => void transition(confirmCancel === 'series' ? 'cancelSeries' : 'cancel')}
                  >
                    {pending === 'cancel' || pending === 'cancelSeries'
                      ? 'Cancelling…'
                      : confirmCancel === 'series'
                        ? `Yes, cancel ${laterLive + 1} dates`
                        : 'Yes, cancel the event'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>
                    Keep it
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn btn-outline" onClick={() => setConfirmCancel('one')}>
                    {event.seriesId ? 'Cancel this date' : 'Cancel event'}
                  </button>
                  {event.seriesId && laterLive > 0 && (
                    <button type="button" className="btn btn-outline" onClick={() => setConfirmCancel('series')}>
                      Cancel this and later dates
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
        <aside className="xl:sticky xl:top-24">
          <EventPreview d={d} host={membership?.name ?? 'Your organisation'} />
        </aside>
      </div>
    </div>
  );
}

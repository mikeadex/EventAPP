'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Segmented } from '@/components/controls';
import { EventGalleryEditor } from '@/components/event-gallery-editor';
import {
  BasicsFields,
  CapacityField,
  WhenWhereFields,
  draftFromEvent,
  draftToPayload,
  validateDraft,
  type EventDraft,
} from '@/components/host/event-form';
import { Icon } from '@/components/icons';
import { TicketTypesEditor } from '@/components/ticket-types-editor';
import { ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Venue } from '@/lib/types';
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
}

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
  const orgSlug = me.data?.memberships.find((m) => m.organizationId === orgId)?.slug;

  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [d, setD] = useState<EventDraft | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [showErrors, setShowErrors] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    publishError ? { ok: false, text: 'Your event was saved as a draft but couldn’t be published. Check the details and try again.' } : null,
  );
  const [pending, setPending] = useState<null | 'save' | 'publish' | 'cancel'>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

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

  async function transition(action: 'publish' | 'cancel') {
    setPending(action);
    setMsg(null);
    try {
      await apiClient(`/v1/events/${eventId}/${action}`, { method: 'POST', body: {} });
      hydrate(await apiClient<OrganizerEvent>(`/v1/events/${eventId}`));
      setConfirmCancel(false);
      setMsg({ ok: true, text: action === 'publish' ? 'Your event is live.' : 'Event cancelled.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Something went wrong.' });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex items-center gap-3">
            <span className={live && !ended ? 'tag' : 'tag-muted'}>{ended && !cancelled ? 'Ended' : STATUS_LABEL[event.status]}</span>
            <span className="text-[13px] text-muted">{event.attendeeCount} going</span>
          </span>
          <h1 className="h1 truncate !text-[40px]">{event.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {live && orgSlug && (
            <Link href={`/${orgSlug}/${event.slug}` as never} target="_blank" className="btn btn-outline">
              <Icon name="external" size={16} /> View live
            </Link>
          )}
          <Link href={`${base}/attendees` as never} className="btn btn-outline">
            <Icon name="users" size={16} /> Attendees
          </Link>
          {(event.status === 'DRAFT' || event.status === 'SCHEDULED') && !ended && (
            <button type="button" className="btn btn-primary" disabled={pending !== null} onClick={() => void transition('publish')}>
              {pending === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`panel p-4 text-[14px] ${msg.ok ? 'text-ink-2' : 'text-accent'}`}>
          {msg.text}
        </p>
      )}
      {cancelled && (
        <p className="panel p-4 text-[14px] text-body">This event is cancelled and can no longer be edited.</p>
      )}

      <form onSubmit={save} noValidate>
        <fieldset disabled={cancelled} className="flex flex-col gap-6">
          <section className="card flex flex-col gap-6 p-6 sm:p-8">
            <h2 className="text-[22px] text-strong">The basics</h2>
            <BasicsFields d={d} set={set} errors={showErrors ? errors : {}} />
          </section>
          <section className="card flex flex-col gap-6 p-6 sm:p-8">
            <h2 className="text-[22px] text-strong">When and where</h2>
            <WhenWhereFields d={d} set={set} errors={showErrors ? errors : {}} disabled={cancelled} />
          </section>
          <section className="card flex flex-col gap-6 p-6 sm:p-8">
            <h2 className="text-[22px] text-strong">Places and visibility</h2>
            <CapacityField d={d} set={set} errors={showErrors ? errors : {}} />
            <Segmented
              label="Who can find it?"
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: 'public', label: 'Public — listed on Discover' },
                { value: 'unlisted', label: 'Unlisted — only people with the link' },
              ]}
            />
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

      <section className="card p-6 sm:p-8">
        {/* onCoverChange keeps the form in step: promoting a gallery image to
            cover otherwise leaves the field above stale, and the next save
            would write the old URL back over it. */}
        <EventGalleryEditor eventId={eventId} coverImageUrl={d.coverImageUrl} onCoverChange={(v) => set('coverImageUrl', v)} />
      </section>

      <section className="card p-6 sm:p-8">
        <TicketTypesEditor eventId={eventId} disabled={cancelled} />
      </section>

      {live && !ended && (
        <section className="card flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] text-strong">Cancel this event</h2>
            <p className="text-[14px] text-body">
              Bookings close and the event page shows it as cancelled. This can&rsquo;t be undone.
            </p>
          </div>
          {confirmCancel ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" disabled={pending !== null} onClick={() => void transition('cancel')}>
                {pending === 'cancel' ? 'Cancelling…' : 'Yes, cancel the event'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline self-start" onClick={() => setConfirmCancel(true)}>
              Cancel event
            </button>
          )}
        </section>
      )}
    </div>
  );
}

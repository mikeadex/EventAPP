'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAdminMe } from '@/components/admin/admin-me';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { booked, eventStatus, isUpcoming, type EventStatus } from '@/components/admin/event-shared';
import { StatusPill } from '@/components/admin/status-pill';
import { Tabs } from '@/components/admin/tabs';
import { useUrlSearch } from '@/components/admin/use-url-search';
import { Icon } from '@/components/icons';
import { adminApi, canModerate, errorCode } from '@/lib/admin-api';
import { fmtDay, fmtTime } from '@/lib/format';
import { ClaimPill, NoticeLine, type ClaimStatus, type Notice } from '../hosts/host-shared';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'ended', label: 'Ended' },
  { key: 'unpublished', label: 'Unpublished' },
];
const STATUS_KEYS = TABS.map((t) => t.key);

/** The list API answers at most this many rows. */
const LIST_CAP = 200;
const REASON_MAX = 500;

/** A row of `GET /v1/admin/events`. */
interface EventRow {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  attendeeCount: number;
  capacity: number | null;
  organization: { id: string; slug: string; name: string; claimStatus: ClaimStatus };
}

type Load = { state: 'loading' } | { state: 'ok'; items: EventRow[] } | { state: 'error' };

export function EventsTable() {
  const me = useAdminMe();
  const canAct = canModerate(me.platformRole);
  const { search, q, draft, setDraft } = useUrlSearch();
  const statusParam = search.get('status') ?? '';
  const status = STATUS_KEYS.includes(statusParam) ? statusParam : 'all';

  const [rows, setRows] = useState<Load>({ state: 'loading' });
  /** Ignores a slow answer to an older search that lands after a newer one. */
  const latest = useRef(0);
  const [target, setTarget] = useState<EventRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const reasonId = useId();

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status });
    if (q) params.set('q', q);
    const call = ++latest.current;
    try {
      const r = await adminApi<{ items: EventRow[] }>(`/events?${params}`);
      if (call === latest.current) setRows({ state: 'ok', items: r.items });
    } catch {
      if (call === latest.current) setRows({ state: 'error' });
    }
  }, [status, q]);

  useEffect(() => {
    setRows({ state: 'loading' });
    void load();
  }, [load]);

  function openUnpublish(e: EventRow) {
    setReason('');
    setTarget(e);
  }

  async function unpublish() {
    if (!target) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await adminApi(`/events/${target.id}/unpublish`, { method: 'POST', body: { reason: trimmed } });
      setNotice({ tone: 'ok', text: `“${target.title}” is unpublished. People booked have been notified.` });
    } catch (e) {
      setNotice({
        tone: 'warn',
        text:
          errorCode(e) === 'NOT_FOUND' || (e instanceof Error && /not found/i.test(e.message))
            ? 'That event isn’t available any more. The list has been refreshed.'
            : e instanceof Error && e.message
              ? e.message
              : 'That didn’t work. Try again.',
      });
    } finally {
      setBusy(false);
      setTarget(null);
      await load();
    }
  }

  const list = rows.state === 'ok' ? rows.items : [];
  const now = Date.now();
  const count = list.length >= LIST_CAP ? `${LIST_CAP}+` : String(list.length);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-accent">Directory</span>
          <h1 className="h1 !text-[40px]">Events</h1>
          <p className="text-[15px] text-ink-2">Every event on Ekklesia, including the ones staff added for a church.</p>
        </div>
        {canAct ? (
          <Link href={'/admin/events/new' as never} className="btn btn-primary">
            <Icon name="plus" />
            Add event for a church
          </Link>
        ) : null}
      </div>

      <Tabs param="status" label="Event status" items={TABS} />

      <label className="field !h-11 !px-4">
        <Icon name="search" className="flex-none text-muted" />
        <span className="sr-only">Search events</span>
        <input
          type="search"
          placeholder="Event or church name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="!text-[15px]"
        />
      </label>

      <NoticeLine notice={notice} />

      {rows.state === 'error' ? (
        <div className="card flex flex-wrap items-center gap-3 p-6" role="alert">
          <p className="text-[14px] text-body">We couldn’t load events.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : rows.state === 'loading' ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <p className="card p-6 text-[14px] text-muted">
          {q || status !== 'all' ? 'No events match these filters.' : 'No events yet.'}
        </p>
      ) : (
        <>
          <ul className="only-sm card mlist" aria-label="Events">
            {list.map((e) => (
              <li key={e.id} className="flex flex-col gap-3 px-4 py-[14px]">
                <span className="flex min-w-0 flex-col gap-1">
                  <EventLink e={e} />
                  <span className="text-[13px] text-muted">
                    {fmtDay(e.startsAt)} · {fmtTime(e.startsAt)}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
                    <HostCell e={e} />
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-2">
                  <StateCell e={e} now={now} />
                  <span>{booked(e)} booked</span>
                  {canAct && isUpcoming(e, now) ? <UnpublishButton e={e} onClick={openUnpublish} /> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="card hide-sm overflow-x-auto">
            <table className="tbl" aria-label="Events">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Church</th>
                  <th scope="col">Booked</th>
                  <th scope="col">Status</th>
                  {canAct ? (
                    <th scope="col" className="!text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="flex flex-col gap-0.5">
                        <EventLink e={e} />
                        <span className="text-[12px] text-muted">
                          {fmtDay(e.startsAt)} · {fmtTime(e.startsAt)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="flex flex-wrap items-center gap-1.5 text-ink-2">
                        <HostCell e={e} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{booked(e)}</td>
                    <td>
                      <StateCell e={e} now={now} />
                    </td>
                    {canAct ? (
                      <td className="text-right">
                        {isUpcoming(e, now) ? <UnpublishButton e={e} onClick={openUnpublish} /> : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-faint">
            Showing {list.length} {list.length === 1 ? 'event' : 'events'}
            {list.length >= LIST_CAP ? ` (the newest ${count})` : ''}
          </p>
        </>
      )}

      <ConfirmDialog
        open={target !== null}
        tone="bad"
        title={target ? `Unpublish ${target.title}?` : 'Unpublish event'}
        confirmLabel={busy ? 'Unpublishing…' : 'Unpublish'}
        busy={busy}
        confirmDisabled={reason.trim().length === 0}
        onCancel={() => setTarget(null)}
        onConfirm={() => void unpublish()}
        body={
          <div className="flex flex-col gap-4">
            <p>
              {target?.title} by {target?.organization.name} comes off Ekklesia and is marked cancelled. People booked
              will be notified.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={reasonId} className="label">
                Reason <span className="text-muted">(kept in the audit log)</span>
              </label>
              <textarea
                id={reasonId}
                className="input"
                rows={3}
                maxLength={REASON_MAX}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <span className="text-[12px] text-muted" aria-hidden="true">
                {reason.length} / {REASON_MAX}
              </span>
            </div>
          </div>
        }
      />
    </>
  );
}

/** Opens the public page; cancelled events still open by direct link. */
function EventLink({ e }: { e: EventRow }) {
  return (
    <Link
      href={`/${e.organization.slug}/${e.slug}` as never}
      className="inline-flex min-h-[44px] items-center text-[15px] text-strong hover:text-accent"
    >
      {e.title}
    </Link>
  );
}

/** The church's name, with its claim pill when staff should know (unclaimed, taken down). */
function HostCell({ e }: { e: EventRow }) {
  const { claimStatus, name } = e.organization;
  return (
    <>
      <span>{name}</span>
      {claimStatus === 'CLAIMED' ? null : <ClaimPill status={claimStatus} />}
    </>
  );
}

function StateCell({ e, now }: { e: EventRow; now: number }) {
  const [tone, label] = eventStatus(e, now);
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

function UnpublishButton({ e, onClick }: { e: EventRow; onClick: (e: EventRow) => void }) {
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      aria-label={`Unpublish ${e.title}`}
      onClick={() => onClick(e)}
    >
      Unpublish
    </button>
  );
}

function Skeleton() {
  return (
    <div className="card overflow-hidden" aria-busy="true">
      <p className="sr-only" role="status">
        Loading events…
      </p>
      <ul aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 border-t border-line px-4 py-[14px] first:border-t-0">
            <span className="flex flex-1 flex-col gap-2">
              <span className="skel w-1/3" />
              <span className="skel w-1/5" />
            </span>
            <span className="skel hidden w-24 sm:block" />
          </li>
        ))}
      </ul>
    </div>
  );
}

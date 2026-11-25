'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { Field } from '@/components/controls';
import { Icon } from '@/components/icons';
import { Avatar, EmptyState, ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { checkInCode, describeResult } from '@/lib/check-in';
import { fmtDay, fmtDayMonth, fmtTime, plural } from '@/lib/format';
import type { Attendee, AttendeeList } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Filter = 'all' | 'in' | 'out';
const ANNOUNCE_MAX = 500;

function csvCell(v: string | null | undefined) {
  // Attendee names are typed by the public. Line breaks and other control
  // characters become spaces, so a value can't start a new row (a bare \r
  // would, unquoted) and smuggle a formula past the check below.
  let s = (v ?? '').replace(/[\x00-\x1f\x7f]+/g, ' ');
  // A leading = + - @ makes a spreadsheet run the cell as a formula.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AttendeesPage() {
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>();
  const list = useApi<AttendeeList>(`/v1/events/${eventId}/tickets`);
  const event = useApi<{
    title: string;
    slug: string;
    startsAt: string;
    timezone: string;
    capacity: number | null;
    isOnline: boolean;
    venue: { name: string } | null;
  }>(`/v1/events/${eventId}`);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string } | null>(null);

  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((a) => {
      if (filter === 'in' && a.status !== 'CHECKED_IN') return false;
      if (filter === 'out' && a.status === 'CHECKED_IN') return false;
      if (!needle) return true;
      return [a.name, a.email, a.code].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [items, q, filter]);

  async function admit(a: Attendee) {
    setBusy(a.id);
    setRowMsg(null);
    const r = await checkInCode(eventId, a.code);
    setBusy(null);
    if (r.kind === 'valid' || r.kind === 'used') {
      list.mutate((p) => ({
        ...p,
        checkedIn: p.checkedIn + (r.kind === 'valid' ? 1 : 0),
        items: p.items.map((x) => (x.id === a.id ? { ...x, status: 'CHECKED_IN', checkedInAt: r.at ?? x.checkedInAt } : x)),
      }));
    }
    if (r.kind !== 'valid') setRowMsg({ id: a.id, text: describeResult(r).body });
  }

  function exportCsv() {
    const rows = [
      ['Name', 'Email', 'Ticket code', 'Ticket type', 'Status', 'Checked in at'],
      ...items.map((a) => [
        a.name,
        a.email ?? '',
        a.code,
        a.ticketType?.name ?? '',
        a.status === 'CHECKED_IN' ? 'Checked in' : 'Registered',
        a.checkedInAt ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `${event.data?.slug ?? 'attendees'}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function announce(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await apiClient<{ recipients: number }>(`/v1/events/${eventId}/announce`, {
        method: 'POST',
        body: { message: message.trim() },
      });
      setSent(`Sent to ${res.recipients} ${res.recipients === 1 ? 'person' : 'people'}.`);
      setMessage('');
      setComposing(false);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'We couldn’t send your message.');
    } finally {
      setSending(false);
    }
  }

  if (list.status === 'error')
    return (
      <ErrorCard
        message={list.error}
        action={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => list.reload()}>
            Try again
          </button>
        }
      />
    );

  const total = list.data?.total ?? 0;
  const checkedIn = list.data?.checkedIn ?? 0;

  const ev = event.data;
  const spotsLeft = ev && ev.capacity !== null ? Math.max(ev.capacity - total, 0) : null;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <span className="eyebrow text-accent">Attendees</span>
          <h1 className="text-[34px] leading-[1.1] text-strong [overflow-wrap:anywhere] sm:text-[40px]">
            {ev?.title ?? 'Attendees'}
          </h1>
          {ev && (
            <p className="text-[15px] text-ink-2">
              {fmtDay(ev.startsAt, ev.timezone)} · {fmtTime(ev.startsAt, ev.timezone)} ·{' '}
              {ev.venue?.name ?? (ev.isOnline ? 'Online' : 'Venue to be confirmed')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={items.length === 0}>
            Export CSV
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setComposing((v) => !v)} aria-expanded={composing}>
            Message attendees
          </button>
          <Link href={`/organizer/organizations/${orgId}/events/${eventId}/check-in` as never} className="btn btn-primary">
            Open scanner
          </Link>
        </div>
      </div>

      {sent && (
        <p role="status" className="panel p-4 text-[14px] text-ink-2">
          {sent}
        </p>
      )}
      {composing && (
        <form onSubmit={announce} className="card flex flex-col gap-4 p-6">
          <Field
            label="Message everyone with a ticket"
            hint="Sent as a notification to their phones. Keep it short — a change of room, a reminder to bring something."
            error={sendError}
            aside={<span className="text-[12px] text-faint">{message.length}/{ANNOUNCE_MAX}</span>}
          >
            {(p) => (
              <textarea
                {...p}
                className="input min-h-[110px]"
                maxLength={ANNOUNCE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary" disabled={sending || !message.trim()}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <dl className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <div className="card flex flex-col gap-1.5 p-5">
          <dt className="eyebrow text-[10px] text-faint">Booked</dt>
          <dd className="text-[30px] leading-none text-strong">{list.data ? total : '—'}</dd>
        </div>
        <div className="card flex flex-col gap-1.5 p-5">
          <dt className="eyebrow text-[10px] text-faint">Checked in</dt>
          <dd className="text-[30px] leading-none text-accent">{list.data ? checkedIn : '—'}</dd>
        </div>
        <div className="card flex flex-col gap-1.5 p-5">
          <dt className="eyebrow text-[10px] text-faint">Spots left</dt>
          <dd className="text-[30px] leading-none text-strong">
            {!list.data || !ev ? '—' : spotsLeft === null ? <span className="text-[20px]">No limit</span> : spotsLeft}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="field !h-12 flex-1 !rounded-full !border-line !bg-surface">
          <Icon name="search" size={18} className="flex-none text-muted" />
          <span className="sr-only">Search attendees</span>
          <input
            type="search"
            placeholder="Search names, emails or ticket codes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div role="group" aria-label="Filter attendees" className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['in', 'Checked in'],
              ['out', 'Not yet'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={filter === v} className="chip" onClick={() => setFilter(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.status === 'loading' ? (
        <div className="card flex flex-col gap-3 p-5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="users" title="Nobody yet" body="When people reserve a place, they’ll appear here." />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="No matches" body="Try a different name or code." />
      ) : (
        <div className="flex flex-col gap-3">
          {/* TODO(confirm): the design's Tickets column ("×2") needs places per
              booking; the list is one row per ticket with no booking id. */}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left" aria-live="polite">
              <thead>
                <tr className="border-b border-line">
                  {['Name', 'Ticket', 'Code', 'Booked', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`px-4 py-3 text-[11px] font-normal uppercase tracking-[0.2em] text-faint ${i === 4 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const isIn = a.status === 'CHECKED_IN';
                  return (
                    <tr key={a.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3.5 align-middle">
                        <span className="flex items-center gap-3">
                          <Avatar name={a.name} src={a.image} size={36} />
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[15px] text-strong [overflow-wrap:anywhere]">{a.name}</span>
                            {a.email && <span className="text-[13px] text-muted [overflow-wrap:anywhere]">{a.email}</span>}
                            {rowMsg?.id === a.id && (
                              <span role="alert" className="error-text">
                                {rowMsg.text}
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle text-[14px] text-ink-2">{a.ticketType?.name ?? 'Place'}</td>
                      <td className="px-4 py-3.5 align-middle font-mono text-[13px] text-ink-2">{a.code}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 align-middle text-[14px] text-muted">
                        {a.issuedAt ? fmtDayMonth(a.issuedAt) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right align-middle">
                        {isIn ? (
                          // Check-in is one-way in the API, so this isn't a toggle.
                          <span className="inline-flex items-center gap-2 text-[14px] text-accent">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                            In{a.checkedInAt ? ` · ${fmtTime(a.checkedInAt)}` : ''}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy !== null}
                            onClick={() => void admit(a)}
                            aria-label={`Check in ${a.name}, ticket ${a.code}`}
                          >
                            {busy === a.id ? 'Checking in…' : 'Check in'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-faint">
            Showing {shown.length} of {plural(total, 'ticket')}
          </p>
        </div>
      )}
    </div>
  );
}

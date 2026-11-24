'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { Field } from '@/components/controls';
import { Icon } from '@/components/icons';
import { EmptyState, ErrorCard, Skeleton } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api-client';
import { checkInCode, describeResult } from '@/lib/check-in';
import { fmtTime } from '@/lib/format';
import type { Attendee, AttendeeList } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Filter = 'all' | 'in' | 'out';
const ANNOUNCE_MAX = 500;

function csvCell(v: string | null | undefined) {
  const s = v ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AttendeesPage() {
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>();
  const list = useApi<AttendeeList>(`/v1/events/${eventId}/tickets`);
  const event = useApi<{ title: string; slug: string }>(`/v1/events/${eventId}`);
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

  if (list.status === 'error') return <ErrorCard message={list.error} />;

  const total = list.data?.total ?? 0;
  const checkedIn = list.data?.checkedIn ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="eyebrow text-accent">Attendees</span>
          <h1 className="h1 truncate !text-[40px]">{event.data?.title ?? 'Attendees'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/organizer/organizations/${orgId}/events/${eventId}/check-in` as never} className="btn btn-primary">
            <Icon name="scan" size={16} /> Open scanner
          </Link>
          <button type="button" className="btn btn-outline" onClick={() => setComposing((v) => !v)} aria-expanded={composing}>
            <Icon name="megaphone" size={16} /> Message attendees
          </button>
          <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={items.length === 0}>
            <Icon name="download" size={16} /> Export CSV
          </button>
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

      <dl className="grid grid-cols-3 gap-4">
        {[
          ['Going', total],
          ['Checked in', checkedIn],
          ['Not yet', total - checkedIn],
        ].map(([k, v]) => (
          <div key={k} className="card flex flex-col gap-2 p-5">
            <dt className="eyebrow text-[10px] text-faint">{k}</dt>
            <dd className="text-[30px] leading-none text-strong">{list.data ? v : '—'}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search attendees</span>
          <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            className="input pl-11"
            placeholder="Search by name, email or ticket code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div role="tablist" aria-label="Filter attendees" className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['in', 'Checked in'],
              ['out', 'Not yet'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={filter === v} className="chip" onClick={() => setFilter(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {list.status === 'loading' ? (
        <Skeleton className="h-64 rounded-card" />
      ) : items.length === 0 ? (
        <EmptyState icon="users" title="Nobody yet" body="When people reserve a place, they’ll appear here." />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="No matches" body="Try a different name or code." />
      ) : (
        <ul className="card divide-y divide-line" aria-live="polite">
          {shown.map((a) => {
            const isIn = a.status === 'CHECKED_IN';
            return (
              <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[16px] text-strong">{a.name}</span>
                  <span className="flex flex-wrap gap-x-3 text-[13px] text-muted">
                    <span className="truncate">{a.email ?? 'No email'}</span>
                    <span className="font-mono text-faint">{a.code}</span>
                  </span>
                  {rowMsg?.id === a.id && (
                    <span role="alert" className="error-text">
                      {rowMsg.text}
                    </span>
                  )}
                </div>
                {isIn ? (
                  <span className="tag flex-none">
                    <Icon name="check" size={13} /> In{a.checkedInAt ? ` · ${fmtTime(a.checkedInAt)}` : ''}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm flex-none self-start sm:self-auto"
                    disabled={busy !== null}
                    onClick={() => void admit(a)}
                  >
                    {busy === a.id ? 'Checking in…' : 'Check in'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

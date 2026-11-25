'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdminMe } from '@/components/admin/admin-me';
import { useUrlSearch } from '@/components/admin/use-url-search';
import { Icon } from '@/components/icons';
import { adminApi, canModerate } from '@/lib/admin-api';
import { fmtDateShort, initials, plural } from '@/lib/format';
import { Avatar, HostPills, KIND_LABELS, NoticeLine, useHostActions, type HostKind, type HostRow } from './host-shared';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'unclaimed', label: 'Unclaimed' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'disputed', label: 'Taken down' },
] as const;
type StatusKey = (typeof STATUSES)[number]['key'];

const KINDS: HostKind[] = ['CHURCH', 'MINISTRY', 'COMMUNITY'];

/** The list API answers at most this many rows. */
const LIST_CAP = 200;

type Load<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error' };

export function HostsTable() {
  const me = useAdminMe();
  const { search, q, draft, setDraft, setParam } = useUrlSearch();

  const statusParam = search.get('status');
  const status: StatusKey = STATUSES.some((s) => s.key === statusParam) ? (statusParam as StatusKey) : 'all';
  const kindParam = search.get('kind')?.toUpperCase();
  const kind = KINDS.includes(kindParam as HostKind) ? (kindParam as HostKind) : null;

  const [rows, setRows] = useState<Load<HostRow[]>>({ state: 'loading' });
  const [all, setAll] = useState<HostRow[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  /** Ignores a slow answer to an older search that lands after a newer one. */
  const latest = useRef(0);

  const loadRows = useCallback(async () => {
    const params = new URLSearchParams({ status });
    if (q) params.set('q', q);
    if (kind) params.set('kind', kind.toLowerCase());
    const call = ++latest.current;
    try {
      const r = await adminApi<{ items: HostRow[] }>(`/hosts?${params}`);
      if (call === latest.current) setRows({ state: 'ok', data: r.items });
    } catch {
      if (call === latest.current) setRows({ state: 'error' });
    }
  }, [status, q, kind]);

  // Unfiltered list for the header line and "of N".
  const loadAll = useCallback(async () => {
    try {
      const r = await adminApi<{ items: HostRow[] }>('/hosts?status=all');
      setAll(r.items);
    } catch {
      setAll(null);
    }
  }, []);

  useEffect(() => {
    setRows({ state: 'loading' });
    void loadRows();
  }, [loadRows]);
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const reload = useCallback(async () => {
    await Promise.all([loadRows(), loadAll()]);
  }, [loadRows, loadAll]);

  const list = rows.state === 'ok' ? rows.data : [];
  const sel = list.find((r) => r.id === selId) ?? null;

  const summary = useMemo(() => {
    if (!all) return null;
    const n = (s: HostRow['claimStatus']) => all.filter((h) => h.claimStatus === s).length;
    return `${n('UNCLAIMED')} unclaimed · ${n('CLAIMED')} claimed · ${n('DISPUTED')} taken down`;
  }, [all]);

  const totalLabel = all ? (all.length >= LIST_CAP ? `${LIST_CAP}+` : String(all.length)) : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-accent">Directory</span>
          <h1 className="h1 !text-[40px]">Hosts</h1>
          <p className="min-h-[1.5em] text-[15px] text-ink-2">{summary}</p>
        </div>
        {canModerate(me.platformRole) ? (
          <Link href={"/admin/events/new" as never} className="btn btn-primary">
            <Icon name="plus" />
            Add a church
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="field min-w-[240px] flex-1 !h-11 !px-4">
          <Icon name="search" className="flex-none text-muted" />
          <span className="sr-only">Search hosts</span>
          <input
            type="search"
            placeholder="Name, slug, city or contact email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="!text-[15px]"
          />
        </label>
        <span className="flex flex-wrap gap-2" role="group" aria-label="Claim status">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              className="chip"
              aria-pressed={status === s.key}
              onClick={() => setParam('status', s.key === 'all' ? null : s.key)}
            >
              {s.label}
            </button>
          ))}
        </span>
        <label className="inline-flex items-center gap-2 text-[13px] text-muted">
          Type
          <select
            className="sel"
            value={kind ?? ''}
            onChange={(e) => setParam('kind', e.target.value ? e.target.value.toLowerCase() : null)}
          >
            <option value="">All types</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.state === 'error' ? (
        <div className="card flex flex-wrap items-center gap-3 p-6" role="alert">
          <p className="text-[14px] text-body">We couldn’t load hosts.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : (
        <div className={sel ? 'hsplit has' : 'hsplit'}>
          {rows.state === 'loading' ? (
            <Skeleton />
          ) : list.length === 0 ? (
            <p className="card p-6 text-[14px] text-muted">
              {q || kind || status !== 'all' ? 'No hosts match these filters.' : 'No hosts yet.'}
            </p>
          ) : (
            <>
              <ul className="only-sm card mlist" aria-label="Hosts">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/hosts/${r.id}` as never} className="mrow min-h-[44px]">
                      <Avatar initials={initials(r.name)} size={40} />
                      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <span className="text-[15px] text-strong">{r.name}</span>
                        <span className="text-[13px] text-muted">
                          {[r.city, plural(r.upcomingCount, 'upcoming event')].filter(Boolean).join(' · ')}
                        </span>
                        {/* Two pills don't fit beside the name at phone width, so they sit under it. */}
                        <span className="mt-1">
                          <HostPills claim={r.claimStatus} verification={r.verificationStatus} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="card hide-sm overflow-x-auto">
                <table className="tbl" aria-label="Hosts">
                  <thead>
                    <tr>
                      <th scope="col">Host</th>
                      <th scope="col">Type</th>
                      <th scope="col">Upcoming</th>
                      <th scope="col">Added</th>
                      <th scope="col" className="!text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const on = r.id === selId;
                      return (
                        <tr key={r.id} className={on ? 'on' : undefined} data-clickable="" onClick={() => setSelId(r.id)}>
                          <td>
                            <button type="button" className="rowbtn" aria-pressed={on} onClick={() => setSelId(r.id)}>
                              <Avatar initials={initials(r.name)} size={36} />
                              <span className="flex flex-col gap-0.5">
                                <span className="nm text-strong">{r.name}</span>
                                <span className="text-[12px] text-muted">{r.city ?? '—'}</span>
                              </span>
                            </button>
                          </td>
                          <td className="text-ink-2">{KIND_LABELS[r.kind]}</td>
                          <td>{r.upcomingCount}</td>
                          <td className="whitespace-nowrap text-muted">{fmtDateShort(r.createdAt)}</td>
                          <td className="text-right">
                            <HostPills claim={r.claimStatus} verification={r.verificationStatus} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {sel ? (
            <SidePanel
              key={sel.id}
              host={sel}
              canAct={canModerate(me.platformRole)}
              onClose={() => setSelId(null)}
              onChanged={reload}
            />
          ) : null}
        </div>
      )}

      {rows.state === 'ok' && totalLabel ? (
        <p className="text-[13px] text-faint">
          Showing {list.length} of {totalLabel} hosts
        </p>
      ) : null}
    </>
  );
}

function SidePanel({
  host,
  canAct,
  onClose,
  onChanged,
}: {
  host: HostRow;
  canAct: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { busy, notice, resend } = useHostActions(host.id, onChanged);
  return (
    <aside className="card hide-sm flex flex-col gap-5 p-6" aria-labelledby="h-host">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 id="h-host" className="text-[22px] text-strong">
            {host.name}
          </h2>
          <HostPills claim={host.claimStatus} verification={host.verificationStatus} />
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close host details">
          <Icon name="close" />
        </button>
      </div>
      <div>
        <div className="kv">
          <span>Contact</span>
          <span className="[overflow-wrap:anywhere]">{host.contactEmail ?? '—'}</span>
        </div>
        <div className="kv">
          <span>Type</span>
          <span>{KIND_LABELS[host.kind]}</span>
        </div>
        <div className="kv">
          <span>City</span>
          <span>{host.city ?? '—'}</span>
        </div>
        <div className="kv">
          <span>Upcoming events</span>
          <span>{host.upcomingCount}</span>
        </div>
        <div className="kv">
          <span>Added</span>
          <span>{fmtDateShort(host.createdAt)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Link href={`/admin/hosts/${host.id}` as never} className="btn btn-primary btn-sm">
          Open full profile
        </Link>
        {host.claimStatus !== 'DISPUTED' ? (
          <Link href={`/${host.slug}` as never} className="btn btn-outline btn-sm" target="_blank">
            View public page ↗
          </Link>
        ) : null}
        {canAct && host.claimStatus === 'UNCLAIMED' ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy !== null}
            aria-busy={busy === 'resend' || undefined}
            onClick={() => void resend(host.contactEmail)}
          >
            {busy === 'resend' ? 'Sending…' : 'Resend claim email'}
          </button>
        ) : null}
      </div>
      <NoticeLine notice={notice} />
    </aside>
  );
}

function Skeleton() {
  return (
    <div className="card overflow-hidden" aria-busy="true">
      <p className="sr-only" role="status">
        Loading hosts…
      </p>
      <ul aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 border-t border-line px-4 py-[14px] first:border-t-0">
            <span className="h-9 w-9 flex-none rounded-full bg-softer" />
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

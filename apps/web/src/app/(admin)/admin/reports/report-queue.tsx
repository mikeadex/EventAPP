'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

interface Action {
  id: string;
  action: string;
  note: string | null;
  createdAt: string;
  actor: string;
}

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'REVIEWING' | 'ACTION_TAKEN' | 'DISMISSED';
  createdAt: string;
  resolvedAt: string | null;
  reporter: string;
  target: {
    kind: 'event' | 'organization' | 'user' | 'unknown';
    id: string;
    label: string;
    slug: string | null;
    status: string | null;
  };
  actions: Action[];
}

type Counts = Record<Report['status'], number>;

const TABS: { key: string; label: string }[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'REVIEWING', label: 'Reviewing' },
  { key: 'ACTION_TAKEN', label: 'Actioned' },
  { key: 'DISMISSED', label: 'Dismissed' },
  { key: 'ALL', label: 'All' },
];

const REASON_LABELS: Record<string, string> = {
  misleading: 'Misleading listing',
  spam: 'Spam or scam',
  hate_or_harassment: 'Hate or harassment',
  safeguarding: 'Safeguarding concern',
  sexual_content: 'Sexual content',
  violence: 'Violence or threats',
  impersonation: 'Impersonation',
  other: 'Other',
};

/** Reports we should look at first regardless of age. */
const URGENT = new Set(['safeguarding', 'violence', 'hate_or_harassment']);

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

/** How close this report is to the 24-hour commitment in the Terms. */
function ageLabel(iso: string) {
  const h = hoursSince(iso);
  if (h < 1) return { text: 'just now', tone: 'text-ink-500' };
  if (h < 24) return { text: `${Math.floor(h)}h ago`, tone: 'text-ink-500' };
  const d = Math.floor(h / 24);
  return {
    text: d === 1 ? 'over 24h ago' : `${d} days ago`,
    tone: 'font-medium text-danger',
  };
}

export function ReportQueue() {
  const [status, setStatus] = useState('OPEN');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Permission errors are terminal; everything else is worth retrying. */
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [list, c] = await Promise.all([
        apiClient<Report[]>(`/v1/admin/reports?status=${status}`),
        apiClient<Counts>('/v1/admin/reports/counts'),
      ]);
      setReports(list);
      setCounts(c);
      setError(null);
      setDenied(false);
    } catch (e) {
      // 403 is the ordinary case for a signed-in non-moderator, so it gets a
      // plain sentence rather than an error banner shouting about a failure.
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) {
        setError('You do not have access to the moderation queue.');
        setDenied(true);
      } else {
        setError(e instanceof Error ? e.message : 'Could not load reports');
        setDenied(false);
      }
      setReports(null);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, path: string, body?: unknown) {
    setBusy(id);
    try {
      await apiClient(`/v1/admin/reports/${id}/${path}`, { method: 'POST', body });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That action failed');
    } finally {
      setBusy(null);
    }
  }

  // Only a permission failure is a dead end. A network blip must not strand a
  // moderator on a screen with no way back — the queue is on a 24-hour clock.
  if (denied) {
    return <p className="mt-8 rounded-md bg-ink-50 p-4 text-sm text-ink-700">{error}</p>;
  }

  return (
    <div className="mt-8">
      {error ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md bg-ink-50 p-4 text-sm text-ink-700">
          <span>{error}</span>
          <button
            onClick={() => void load()}
            className="rounded-full border border-ink-300 px-3 py-1 text-xs"
          >
            Try again
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              status === t.key
                ? 'border-ink-900 bg-ink-900 text-ink-0'
                : 'border-ink-200 text-ink-700 hover:border-ink-400'
            }`}
          >
            {t.label}
            {counts && t.key !== 'ALL' ? (
              <span className="ml-2 opacity-70">{counts[t.key as Report['status']]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {reports === null ? (
        <p className="mt-8 text-sm text-ink-500">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-8 text-sm text-ink-500">Nothing here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reports.map((r) => {
            const age = ageLabel(r.createdAt);
            const open = r.status === 'OPEN' || r.status === 'REVIEWING';
            return (
              <li key={r.id} className="rounded-lg border border-ink-200 p-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium text-ink-900">
                    {REASON_LABELS[r.reason] ?? r.reason}
                  </span>
                  {URGENT.has(r.reason) && open ? (
                    <span className="rounded-full bg-danger px-2 py-0.5 text-xs text-ink-0">
                      Priority
                    </span>
                  ) : null}
                  <span className={`text-xs ${age.tone}`}>{age.text}</span>
                  <span className="text-xs text-ink-400">· {r.status.toLowerCase()}</span>
                </div>

                <p className="mt-3 text-sm text-ink-700">
                  <span className="text-ink-500">Target: </span>
                  {r.target.kind === 'event' && r.target.slug ? (
                    <a
                      href={`/events/${r.target.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {r.target.label}
                    </a>
                  ) : (
                    r.target.label
                  )}
                  <span className="text-ink-400">
                    {' '}
                    ({r.target.kind}
                    {r.target.status ? `, ${r.target.status.toLowerCase()}` : ''})
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink-500">Reported by {r.reporter}</p>
                {r.details ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-md bg-ink-50 p-3 text-sm text-ink-700">
                    {r.details}
                  </p>
                ) : null}

                {r.actions.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-ink-500">
                    {r.actions.map((a) => (
                      <li key={a.id}>
                        <span className="font-medium text-ink-700">{a.action}</span> by {a.actor}
                        {a.note ? ` — ${a.note}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {open ? (
                  <div className="mt-4 border-t border-ink-100 pt-4">
                    <label className="block text-xs text-ink-500" htmlFor={`note-${r.id}`}>
                      Note (kept on the record, and what an appeal is answered from)
                    </label>
                    <textarea
                      id={`note-${r.id}`}
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-ink-200 p-2 text-sm"
                      placeholder="What you found, and why you decided this."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.status === 'OPEN' ? (
                        <button
                          disabled={busy === r.id}
                          onClick={() => void act(r.id, 'review')}
                          className="rounded-full border border-ink-300 px-4 py-1.5 text-sm disabled:opacity-50"
                        >
                          Start review
                        </button>
                      ) : null}
                      {r.target.kind === 'event' ? (
                        <button
                          disabled={busy === r.id}
                          onClick={() =>
                            void act(r.id, 'resolve', {
                              action: 'takedown_event',
                              note: notes[r.id],
                            })
                          }
                          className="rounded-full bg-danger px-4 py-1.5 text-sm text-ink-0 disabled:opacity-50"
                        >
                          Unpublish event
                        </button>
                      ) : null}
                      <button
                        disabled={busy === r.id}
                        onClick={() =>
                          void act(r.id, 'resolve', { action: 'warn', note: notes[r.id] })
                        }
                        className="rounded-full border border-ink-300 px-4 py-1.5 text-sm disabled:opacity-50"
                      >
                        Record warning
                      </button>
                      <button
                        disabled={busy === r.id}
                        onClick={() =>
                          void act(r.id, 'resolve', { action: 'dismiss', note: notes[r.id] })
                        }
                        className="rounded-full border border-ink-300 px-4 py-1.5 text-sm disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

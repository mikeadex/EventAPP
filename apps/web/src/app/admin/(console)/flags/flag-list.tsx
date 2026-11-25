'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdminMe } from '@/components/admin/admin-me';
import { Switch } from '@/components/controls';
import { Icon } from '@/components/icons';
import { Skeleton } from '@/components/ui';
import { adminApi, canAdminister, type AdminFlag } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { fmtDateShort } from '@/lib/format';

/** What each flag unlocks, in the apps' own words. Keys match `@ekklesia/shared`. */
const ABOUT: Record<string, { title: string; body: string }> = {
  paid_tickets: {
    title: 'Paid tickets',
    body: 'Hosts can price ticket types and attendees pay by card. Each host still needs Stripe payouts enabled.',
  },
  donations: { title: 'Donations', body: 'Donation tickets and giving to a host. No API behind it yet.' },
  reviews: { title: 'Reviews', body: 'Attendees can review events they went to.' },
  recurring_events: { title: 'Recurring events', body: 'Weekly and monthly series from one event.' },
  waitlists: { title: 'Waitlists', body: 'Join a list when an event is full.' },
  referral_links: { title: 'Referral links', body: 'Trackable share links for hosts.' },
  organizer_analytics: { title: 'Organiser analytics', body: 'Sales and check-in figures on the host dashboard.' },
  advanced_check_in: { title: 'Advanced check-in', body: 'Multiple doors and scanner roles.' },
  groups: { title: 'Groups', body: 'Small groups and ministries under a host.' },
  livestream: { title: 'Livestream', body: 'Streaming inside the app rather than a link out.' },
};

export function FlagList() {
  const me = useAdminMe();
  const canEdit = canAdminister(me.platformRole);
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setFlags(await adminApi<AdminFlag[]>('/feature-flags'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load feature flags');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setPlatform(key: string, enabled: boolean) {
    setBusy(key);
    // Optimistic: the switch moves at once; a refusal puts it back.
    setFlags((f) => f?.map((x) => (x.key === key ? { ...x, enabled } : x)) ?? null);
    try {
      await adminApi(`/feature-flags/${key}`, { method: 'PATCH', body: { enabled } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That change was refused');
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function setOverride(key: string, org: string, enabled: boolean | null) {
    setBusy(`${key}:${org}`);
    try {
      await adminApi(`/feature-flags/${key}/organizations/${encodeURIComponent(org)}`, {
        method: 'PATCH',
        body: { enabled },
      });
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That change was refused');
    } finally {
      setBusy(null);
    }
  }

  if (!flags) {
    return (
      <div className="mt-8 flex flex-col gap-4" aria-busy="true">
        {error ? (
          <p role="alert" className="panel p-4 text-[14px] text-accent">
            {error}
          </p>
        ) : (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-card" />)
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      {error && (
        <p role="alert" className="panel p-4 text-[14px] text-accent">
          {error}
        </p>
      )}
      {!canEdit && (
        <p className="text-[13px] text-muted">You can see the switches; only a super admin can move them.</p>
      )}
      <ul className="flex flex-col gap-4">
        {flags.map((f) => (
          <FlagRow
            key={f.key}
            flag={f}
            canEdit={canEdit}
            busy={busy}
            onPlatform={(v) => void setPlatform(f.key, v)}
            onOverride={(org, v) => void setOverride(f.key, org, v)}
          />
        ))}
      </ul>
    </div>
  );
}

function FlagRow({
  flag,
  canEdit,
  busy,
  onPlatform,
  onOverride,
}: {
  flag: AdminFlag;
  canEdit: boolean;
  busy: string | null;
  onPlatform: (enabled: boolean) => void;
  onOverride: (org: string, enabled: boolean | null) => void;
}) {
  const about = ABOUT[flag.key] ?? { title: flag.key, body: flag.description ?? '' };
  const [open, setOpen] = useState(flag.overrides.length > 0);
  const [org, setOrg] = useState('');
  const [orgOn, setOrgOn] = useState(true);

  function addOverride(e: FormEvent) {
    e.preventDefault();
    if (!org.trim()) return;
    onOverride(org.trim(), orgOn);
    setOrg('');
  }

  return (
    <li className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] text-strong">{about.title}</span>
            <span className="font-mono text-[12px] text-faint">{flag.key}</span>
            <span className={flag.enabled ? 'tag' : 'tag-muted'}>{flag.enabled ? 'On' : 'Off'}</span>
            {flag.enabled !== flag.default && <span className="tag-muted">Default {flag.default ? 'on' : 'off'}</span>}
          </span>
          <span className="text-[14px] leading-relaxed text-body">{about.body}</span>
          {flag.updatedAt && <span className="text-[12px] text-muted">Changed {fmtDateShort(flag.updatedAt)}</span>}
        </div>
        <Switch
          checked={flag.enabled}
          onChange={onPlatform}
          label={`${about.title} for everyone`}
          disabled={!canEdit || busy === flag.key}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="flex items-center gap-2 self-start text-[13px] text-ink-2 hover:text-accent"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? 'minus' : 'plus'} size={14} />
          {flag.overrides.length === 0
            ? 'Per-organisation overrides'
            : `${flag.overrides.length} organisation ${flag.overrides.length === 1 ? 'override' : 'overrides'}`}
        </button>
        {open && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
            {flag.overrides.length > 0 && (
              <ul className="flex flex-col divide-y divide-line">
                {flag.overrides.map((o) => (
                  <li key={o.organizationId} className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-strong">{o.name}</span>
                      <span className="font-mono text-[12px] text-faint">{o.slug}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={o.enabled ? 'tag' : 'tag-muted'}>{o.enabled ? 'On' : 'Off'}</span>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy === `${flag.key}:${o.organizationId}`}
                          onClick={() => onOverride(o.organizationId, null)}
                          aria-label={`Remove override for ${o.name}`}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canEdit && (
              <form onSubmit={addOverride} className="flex flex-wrap items-center gap-3">
                <input
                  className="input min-h-[44px] flex-1 !rounded-xl"
                  placeholder="Organisation slug or id"
                  aria-label="Organisation slug or id"
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                />
                <label className="flex items-center gap-2 text-[14px] text-ink-2">
                  <Switch checked={orgOn} onChange={setOrgOn} label="Override value" />
                  {orgOn ? 'On' : 'Off'}
                </label>
                <button type="submit" className="btn btn-outline btn-sm" disabled={!org.trim() || busy !== null}>
                  Set override
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

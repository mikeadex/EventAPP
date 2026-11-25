'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdminMe } from '@/components/admin/admin-me';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { booked, eventStatus, isUpcoming, type EventStatus } from '@/components/admin/event-shared';
import { KpiCard } from '@/components/admin/kpi-card';
import { StatusPill } from '@/components/admin/status-pill';
import { Tabs } from '@/components/admin/tabs';
import { Icon } from '@/components/icons';
import { adminApi, canModerate } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { fmtDateShort, fmtDay, fmtTime, initials, plural } from '@/lib/format';
import {
  Avatar,
  HostPills,
  KIND_LABELS,
  NoticeLine,
  useHostActions,
  type ClaimStatus,
  type HostKind,
  type VerificationStatus,
} from '../host-shared';
import { ContactDialog } from './contact-dialog';

interface HostEvent {
  id: string;
  slug: string;
  title: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  attendeeCount: number;
  capacity: number | null;
  publishedAt: string | null;
  cancelledAt: string | null;
}

/** `GET /v1/admin/hosts/:id`. */
interface HostDetail {
  id: string;
  name: string;
  slug: string;
  kind: HostKind;
  city: string | null;
  country: string | null;
  currency: string | null;
  claimStatus: ClaimStatus;
  verificationStatus: VerificationStatus;
  contactName: string | null;
  contactEmail: string | null;
  claimedAt: string | null;
  createdAt: string;
  addedBy: { id: string; name: string | null; email: string } | null;
  events: HostEvent[];
  lastInviteAt: string | null;
}

type Load = { state: 'loading' } | { state: 'ok'; host: HostDetail } | { state: 'missing' } | { state: 'error' };

/** Drafts have no public page; everything else opens by direct link (cancelled included). */
function EventTitle({ host, e }: { host: HostDetail; e: HostEvent }) {
  if (e.status === 'DRAFT') return <span className="text-strong">{e.title}</span>;
  return (
    <Link href={`/${host.slug}/${e.slug}` as never} className="text-strong hover:text-accent">
      {e.title}
    </Link>
  );
}

export function HostProfile({ hostId }: { hostId: string }) {
  const me = useAdminMe();
  const canAct = canModerate(me.platformRole);
  const search = useSearchParams();
  const tab = search.get('tab') === 'events' ? 'events' : 'overview';

  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [dialog, setDialog] = useState<'contact' | 'restore' | null>(null);
  const [sendInvite, setSendInvite] = useState(true);

  const fetchHost = useCallback(async () => {
    try {
      const host = await adminApi<HostDetail>(`/hosts/${hostId}`);
      setLoad({ state: 'ok', host });
    } catch (e) {
      setLoad(e instanceof ApiError && e.status === 404 ? { state: 'missing' } : { state: 'error' });
    }
  }, [hostId]);

  useEffect(() => {
    void fetchHost();
  }, [fetchHost]);

  const { busy, notice, resend, changeContact, restore } = useHostActions(hostId, fetchHost);

  if (load.state === 'loading') {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <p className="sr-only" role="status">
          Loading host…
        </p>
        <span className="skel w-24" />
        <div className="flex items-center gap-[18px]">
          <span className="h-[72px] w-[72px] flex-none rounded-full bg-softer" />
          <span className="flex flex-1 flex-col gap-3">
            <span className="skel !h-6 w-1/3" />
            <span className="skel w-1/4" />
          </span>
        </div>
        <div className="card h-40" />
      </div>
    );
  }

  if (load.state !== 'ok') {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb current="Not found" />
        <div className="card flex flex-wrap items-center gap-3 p-6" role="alert">
          <p className="text-[14px] text-body">
            {load.state === 'missing'
              ? 'This host doesn’t exist, or it has been removed.'
              : 'We couldn’t load this host.'}
          </p>
          {load.state === 'error' ? (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void fetchHost()}>
              Try again
            </button>
          ) : (
            <Link href="/admin/hosts" className="btn btn-outline btn-sm">
              Back to hosts
            </Link>
          )}
        </div>
      </div>
    );
  }

  const host = load.host;
  const now = Date.now();
  const upcoming = host.events
    .filter((e) => isUpcoming(e, now))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const unclaimed = host.claimStatus === 'UNCLAIMED';
  const disputed = host.claimStatus === 'DISPUTED';
  const sub = [KIND_LABELS[host.kind], host.city, `added ${fmtDateShort(host.createdAt)}`].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb current={host.name} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[18px]">
          <Avatar initials={initials(host.name)} size={72} />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="h1 !text-[36px] break-words">{host.name}</h1>
            <span className="flex flex-wrap items-center gap-2.5 text-[14px] text-muted">
              <HostPills claim={host.claimStatus} verification={host.verificationStatus} />
              {sub}
            </span>
          </div>
        </div>
        <span className="flex flex-wrap gap-2.5">
          {!disputed ? (
            <Link href={`/${host.slug}` as never} className="btn btn-outline btn-sm" target="_blank">
              Public page ↗
            </Link>
          ) : null}
          {canAct && unclaimed ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={busy !== null}
                aria-busy={busy === 'resend' || undefined}
                onClick={() => void resend(host.contactEmail)}
              >
                {busy === 'resend' ? 'Sending…' : 'Resend claim email'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={busy !== null}
                onClick={() => setDialog('contact')}
              >
                Change contact email
              </button>
              <Link href={`/admin/events/new?hostId=${host.id}` as never} className="btn btn-primary btn-sm">
                <Icon name="plus" size={16} />
                Add event
              </Link>
            </>
          ) : null}
        </span>
      </div>

      <NoticeLine notice={notice} />

      {disputed ? (
        <div className="alert">
          <Icon name="alert" size={20} className="flex-none text-accent" />
          <span className="flex min-w-[240px] flex-1 flex-col gap-0.5">
            {/* TODO(confirm): final wording of the taken-down banner. */}
            <span className="text-[15px] text-strong">Taken down by the church</span>
            <span className="text-[13px] text-ink-2">
              Someone used the take-down link in the claim email. The page is hidden and its events were unpublished.
              Restoring lists it again as unclaimed; its events stay unpublished.
            </span>
          </span>
          {canAct ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy !== null}
              onClick={() => {
                setSendInvite(Boolean(host.contactEmail));
                setDialog('restore');
              }}
            >
              Restore
            </button>
          ) : null}
        </div>
      ) : null}

      <Tabs
        param="tab"
        label="Host sections"
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'events', label: 'Events', count: host.events.length },
        ]}
      />

      {tab === 'overview' ? (
        <div className="flex flex-col gap-6">
          <div className="kpis">
            <KpiCard
              label="Upcoming events"
              value={upcoming.length}
              sub={`${host.events.filter((e) => e.publishedAt).length} published in total`}
            />
            <KpiCard
              label="Bookings"
              value={host.events.reduce((n, e) => n + e.attendeeCount, 0).toLocaleString('en-GB')}
              sub={`Across ${plural(host.events.length, 'event')}`}
            />
            {host.claimStatus === 'CLAIMED' ? (
              <KpiCard label="Claimed" value={host.claimedAt ? fmtDateShort(host.claimedAt) : '—'} sub="By the church" />
            ) : (
              <KpiCard
                label="Last claim email"
                value={host.lastInviteAt ? fmtDateShort(host.lastInviteAt) : 'Never'}
                sub={host.contactEmail ? `To ${host.contactEmail}` : 'No contact email'}
              />
            )}
          </div>

          <div className="two">
            <section className="card overflow-hidden" aria-labelledby="h-up">
              <div className="flex items-center justify-between gap-3 p-5">
                <h2 id="h-up" className="text-[20px] text-strong">
                  Upcoming events
                </h2>
                {host.events.length > 0 ? (
                  <Link
                    href={`/admin/hosts/${host.id}?tab=events` as never}
                    scroll={false}
                    className="inline-flex min-h-[44px] items-center text-[14px] text-accent"
                  >
                    All {plural(host.events.length, 'event')}
                  </Link>
                ) : null}
              </div>
              {upcoming.length === 0 ? (
                <p className="border-t border-line px-5 py-4 text-[14px] text-muted">No upcoming events.</p>
              ) : (
                <ul>
                  {upcoming.slice(0, 5).map((e) => {
                    const [tone, label] = eventStatus(e, now);
                    return (
                      <li key={e.id} className="flex items-center gap-4 border-t border-line px-5 py-[14px]">
                        <span className="flex h-[52px] w-[52px] flex-none flex-col items-center justify-center rounded-[14px] border border-line-2">
                          <span className="text-[10px] uppercase tracking-[.16em] text-accent">
                            {new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Europe/London' }).format(
                              new Date(e.startsAt),
                            )}
                          </span>
                          <span className="text-[18px] text-strong">
                            {new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Europe/London' }).format(
                              new Date(e.startsAt),
                            )}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15px]">
                            <EventTitle host={host} e={e} />
                          </span>
                          <span className="text-[13px] text-muted">
                            {fmtDay(e.startsAt)} {fmtTime(e.startsAt)} · {booked(e)} booked
                          </span>
                        </span>
                        <StatusPill tone={tone}>{label}</StatusPill>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card px-5 py-2" aria-label="Organisation details">
              <div className="kv">
                <span>Contact</span>
                <span className="flex min-w-0 flex-col items-end [overflow-wrap:anywhere]">
                  {host.contactName ? <span>{host.contactName}</span> : null}
                  <span>{host.contactEmail ?? '—'}</span>
                </span>
              </div>
              <div className="kv">
                <span>City</span>
                <span>{[host.city, host.country].filter(Boolean).join(', ') || '—'}</span>
              </div>
              <div className="kv">
                <span>Currency</span>
                <span>{host.currency ?? '—'}</span>
              </div>
              <div className="kv">
                <span>Public page</span>
                <span className="mono text-[13px]">/{host.slug}</span>
              </div>
              <div className="kv">
                <span>Added by</span>
                <span>
                  {host.addedBy
                    ? `${host.addedBy.name || host.addedBy.email} · ${fmtDateShort(host.createdAt)}`
                    : `Signed up · ${fmtDateShort(host.createdAt)}`}
                </span>
              </div>
              {host.claimStatus === 'CLAIMED' && host.claimedAt ? (
                <div className="kv">
                  <span>Claimed</span>
                  <span>{fmtDateShort(host.claimedAt)}</span>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : host.events.length === 0 ? (
        <p className="card p-6 text-[14px] text-muted">No events yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl tbl-roomy" aria-label={`Events by ${host.name}`}>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Date</th>
                <th scope="col">Booked</th>
                <th scope="col" className="!text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {host.events.map((e) => {
                const [tone, label] = eventStatus(e, now);
                return (
                  <tr key={e.id}>
                    <td>
                      <EventTitle host={host} e={e} />
                    </td>
                    <td className="text-muted">
                      {fmtDay(e.startsAt)} {fmtTime(e.startsAt)}
                    </td>
                    <td>{booked(e)}</td>
                    <td className="text-right">
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ContactDialog
        open={dialog === 'contact'}
        hostName={host.name}
        currentName={host.contactName}
        currentEmail={host.contactEmail}
        busy={busy === 'contact'}
        onCancel={() => setDialog(null)}
        onSave={async (body) => {
          await changeContact(body);
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog === 'restore'}
        title={`Restore ${host.name}?`}
        confirmLabel={busy === 'restore' ? 'Restoring…' : 'Restore'}
        busy={busy === 'restore'}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          await restore(sendInvite && Boolean(host.contactEmail));
          setDialog(null);
        }}
        body={
          <div className="flex flex-col gap-4">
            <p>
              It will be listed on Ekklesia again as unclaimed. Its events stay unpublished, and the claim and take-down
              links already sent stay cancelled.
            </p>
            {host.contactEmail ? (
              <label className="flex min-h-[44px] items-center gap-3 text-[15px] text-ink">
                <input
                  type="checkbox"
                  className="h-5 w-5 flex-none accent-[var(--accent)]"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                <span>
                  Send a new claim email to <span className="[overflow-wrap:anywhere]">{host.contactEmail}</span>
                </span>
              </label>
            ) : (
              <p className="text-[14px] text-muted">There’s no contact email, so no claim email can be sent.</p>
            )}
          </div>
        }
      />
    </div>
  );
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
      <Link href="/admin/hosts" className="text-accent">
        Hosts
      </Link>{' '}
      / <span aria-current="page">{current}</span>
    </nav>
  );
}

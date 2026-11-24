'use client';

import { useCallback, useState } from 'react';
import { StatusPill, type StatusTone } from '@/components/admin/status-pill';
import { adminApi, errorCode } from '@/lib/admin-api';

export type ClaimStatus = 'UNCLAIMED' | 'CLAIMED' | 'DISPUTED';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type HostKind = 'CHURCH' | 'MINISTRY' | 'COMMUNITY';

/** A row of `GET /v1/admin/hosts`. */
export interface HostRow {
  id: string;
  name: string;
  slug: string;
  kind: HostKind;
  city: string | null;
  claimStatus: ClaimStatus;
  verificationStatus: VerificationStatus;
  contactEmail: string | null;
  upcomingCount: number;
  createdAt: string;
}

export const KIND_LABELS: Record<HostKind, string> = {
  CHURCH: 'Church',
  MINISTRY: 'Ministry',
  COMMUNITY: 'Community',
};

const CLAIM: Record<ClaimStatus, [StatusTone, string]> = {
  UNCLAIMED: ['warn', 'Unclaimed'],
  CLAIMED: ['ok', 'Claimed'],
  DISPUTED: ['bad', 'Taken down'],
};

const VERIFICATION: Record<VerificationStatus, [StatusTone, string]> = {
  UNVERIFIED: ['default', 'Unverified'],
  PENDING: ['warn', 'Pending review'],
  VERIFIED: ['ok', 'Verified'],
  REJECTED: ['bad', 'Rejected'],
  SUSPENDED: ['bad', 'Suspended'],
};

export function ClaimPill({ status }: { status: ClaimStatus }) {
  const [tone, label] = CLAIM[status];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

export function VerificationPill({ status }: { status: VerificationStatus }) {
  const [tone, label] = VERIFICATION[status];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

/** Claim status first (what staff act on), then verification. */
export function HostPills({ claim, verification }: { claim: ClaimStatus; verification: VerificationStatus }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <ClaimPill status={claim} />
      <VerificationPill status={verification} />
    </span>
  );
}

export function Avatar({ initials, size }: { initials: string; size: 36 | 40 | 72 }) {
  const font = size === 72 ? 'text-[22px]' : size === 40 ? 'text-[13px]' : 'text-[12px]';
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full border border-line-3 bg-avatar text-accent ${font}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export interface Notice {
  tone: 'ok' | 'warn';
  text: string;
}

const EMAIL_FAILED = 'Saved, but the email didn’t send — try Resend.';

/** Plain-language message for a refused host action. */
function refusal(e: unknown): string {
  switch (errorCode(e)) {
    case 'NOT_UNCLAIMED':
      return 'This church isn’t unclaimed any more, so there’s no claim email to send. The page has been refreshed.';
    case 'NO_CONTACT_EMAIL':
      return 'This church has no contact email. Add one with “Change contact email” first.';
    case 'NOT_DISPUTED':
      return 'This church isn’t taken down any more. The page has been refreshed.';
    default:
      return e instanceof Error && e.message ? e.message : 'That didn’t work. Try again.';
  }
}

/**
 * Resend / change contact / restore for one host, with one result line.
 * `onChanged` reloads whatever shows the host; it runs after every attempt,
 * since a refusal (e.g. NOT_UNCLAIMED) means the page is out of date.
 */
export function useHostActions(hostId: string, onChanged: () => void | Promise<void>) {
  const [busy, setBusy] = useState<'resend' | 'contact' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const run = useCallback(
    async <T,>(kind: 'resend' | 'contact' | 'restore', call: () => Promise<T>, done: (r: T) => Notice) => {
      setBusy(kind);
      setNotice(null);
      try {
        const r = await call();
        setNotice(done(r));
        return true;
      } catch (e) {
        setNotice({ tone: 'warn', text: refusal(e) });
        return false;
      } finally {
        setBusy(null);
        await onChanged();
      }
    },
    [onChanged],
  );

  const resend = useCallback(
    (email: string | null) =>
      run(
        'resend',
        () => adminApi<{ inviteSent: boolean }>(`/hosts/${hostId}/resend`, { method: 'POST' }),
        (r) =>
          r.inviteSent
            ? { tone: 'ok', text: `Claim email sent${email ? ` to ${email}` : ''}.` }
            : { tone: 'warn', text: 'The claim email didn’t send — try Resend again in a moment.' },
      ),
    [hostId, run],
  );

  const changeContact = useCallback(
    (body: { contactName?: string; contactEmail: string }) =>
      run(
        'contact',
        () => adminApi<{ inviteSent: boolean }>(`/hosts/${hostId}/contact`, { method: 'PATCH', body }),
        (r) =>
          r.inviteSent
            ? { tone: 'ok', text: `Contact changed. A new claim email is on its way to ${body.contactEmail}.` }
            : { tone: 'warn', text: EMAIL_FAILED },
      ),
    [hostId, run],
  );

  const restore = useCallback(
    (sendInvite: boolean) =>
      run(
        'restore',
        () =>
          adminApi<{ inviteSent: boolean | null }>(`/hosts/${hostId}/restore`, {
            method: 'POST',
            body: { sendInvite },
          }),
        (r) =>
          r.inviteSent === null
            ? { tone: 'ok', text: 'Restored. The church is listed again; its events stay unpublished.' }
            : r.inviteSent
              ? { tone: 'ok', text: 'Restored, and a new claim email is on its way.' }
              : { tone: 'warn', text: EMAIL_FAILED },
      ),
    [hostId, run],
  );

  return { busy, notice, setNotice, resend, changeContact, restore };
}

/** The result line under a host's actions. Polite live region, text not colour alone. */
export function NoticeLine({ notice }: { notice: Notice | null }) {
  return (
    <p role="status" className={notice ? 'text-[14px] leading-relaxed text-body' : 'sr-only'}>
      {notice ? (
        <>
          <span aria-hidden="true" className={notice.tone === 'ok' ? 'text-[var(--ok)]' : 'text-[var(--warn)]'}>
            {notice.tone === 'ok' ? '✓ ' : '! '}
          </span>
          {notice.text}
        </>
      ) : null}
    </p>
  );
}

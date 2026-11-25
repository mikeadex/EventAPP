'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, apiClient } from '@/lib/api-client';
import { signIn, signOut, useSession } from '@/lib/auth-client';
import { SUPPORT_EMAIL } from '@/lib/contact';
import { fmtDateLong } from '@/lib/format';
import type { ClaimInfo } from '@/lib/types';
import { signInHref } from '@/lib/url';
import { Field, PasswordInput } from '@/components/controls';
import { Icon, type IconName } from '@/components/icons';
import { PASSWORD_MIN, PasswordMeter } from '@/components/password-meter';
import { SocialSignIn } from '@/components/social-sign-in';

/** The 410 codes a claim link can answer with. */
type GoneCode = 'INVALID' | 'USED' | 'EXPIRED' | 'CLAIMED';
type Load =
  | { s: 'loading' }
  | { s: 'ready'; info: ClaimInfo }
  | { s: 'gone'; code: GoneCode }
  | { s: 'error'; message: string };
/** Why an attach was refused, when the page can say something useful. */
type AttachRefusal = 'EMAIL_MISMATCH' | 'EMAIL_NOT_VERIFIED' | 'STAFF_ACCOUNT';
type Claimed = { id: string; slug: string; name: string };

const GONE: GoneCode[] = ['INVALID', 'USED', 'EXPIRED', 'CLAIMED'];

function codeOf(err: unknown): string | undefined {
  if (!(err instanceof ApiError) || !err.payload || typeof err.payload !== 'object') return undefined;
  const code = (err.payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
const goneCode = (err: unknown) => {
  const code = codeOf(err);
  return err instanceof ApiError && err.status === 410 && GONE.includes(code as GoneCode)
    ? (code as GoneCode)
    : undefined;
};
const tooMany = (err: unknown) => err instanceof ApiError && err.status === 429;

const TOO_MANY = 'Too many tries from this connection. Wait a minute, then try again.';
const dashboard = (org: Claimed) => `/organizer/organizations/${org.id}`;

/**
 * The page behind the link in a claim email. Someone new sets a password (or
 * uses Google); someone with an account signs in and comes back with
 * `?attach=1`, which claims the church for the signed-in account.
 */
export function ClaimFlow({ token }: { token: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const wantsAttach = params.get('attach') === '1';
  const { data: session, isPending: sessionPending } = useSession();

  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [attaching, setAttaching] = useState(false);
  const [refusal, setRefusal] = useState<AttachRefusal | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Claimed with a password: signing in and leaving for the dashboard, or
  // (if signing in failed) asking them to sign in.
  const [claimed, setClaimed] = useState<{ org: Claimed; signedIn: boolean | null } | null>(null);
  const attempted = useRef(false);

  const path = `/claim/${encodeURIComponent(token)}`;
  const attachPath = `${path}?attach=1`;

  useEffect(() => {
    let cancelled = false;
    apiClient<ClaimInfo>(`/v1/claims/${encodeURIComponent(token)}`)
      .then((info) => !cancelled && setLoad({ s: 'ready', info }))
      .catch((err) => {
        if (cancelled) return;
        const code = goneCode(err);
        if (code) setLoad({ s: 'gone', code });
        else
          setLoad({
            s: 'error',
            message: tooMany(err) ? TOO_MANY : 'We couldn’t open this link. Please try again.',
          });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const attach = useCallback(async () => {
    setAttaching(true);
    setRefusal(null);
    setAttachError(null);
    try {
      const res = await apiClient<{ organization: Claimed }>(
        `/v1/claims/${encodeURIComponent(token)}/attach`,
        { method: 'POST' },
      );
      router.replace(dashboard(res.organization) as never);
      router.refresh();
    } catch (err) {
      setAttaching(false);
      const gone = goneCode(err);
      if (gone) return setLoad({ s: 'gone', code: gone });
      const code = codeOf(err);
      if (code === 'EMAIL_MISMATCH' || code === 'EMAIL_NOT_VERIFIED' || code === 'STAFF_ACCOUNT') {
        return setRefusal(code);
      }
      setAttachError(tooMany(err) ? TOO_MANY : 'We couldn’t claim it just now. Please try again.');
    }
  }, [token, router]);

  // Back from sign-in (or Google) with ?attach=1: claim straight away, once.
  const signedIn = !!session?.user;
  useEffect(() => {
    if (!wantsAttach || load.s !== 'ready' || sessionPending || !signedIn || attempted.current) return;
    attempted.current = true;
    void attach();
  }, [wantsAttach, load.s, sessionPending, signedIn, attach]);

  if (load.s === 'loading') {
    return (
      <p role="status" className="py-10 text-center text-[15px] text-body">
        Opening your link…
      </p>
    );
  }
  if (load.s === 'error') return <Notice icon="alert" title="Something went wrong" body={load.message} />;
  if (load.s === 'gone') {
    return (
      <GoneNotice
        code={load.code}
        token={token}
        signedIn={signedIn}
        onGone={(code) => setLoad({ s: 'gone', code })}
      />
    );
  }

  const { info } = load;
  const invited = info.email;
  const sessionEmail = session?.user?.email ?? null;
  const sameAccount = !!sessionEmail && sessionEmail.toLowerCase() === invited.toLowerCase();

  /** Sign out of the wrong account and sign in with the invited one. */
  async function switchAccount() {
    await signOut().catch(() => undefined);
    router.push(signInHref(attachPath) as never);
  }

  /** The password claim went through: sign in with it and open the dashboard. */
  async function afterPasswordClaim(org: Claimed, password: string) {
    setClaimed({ org, signedIn: null });
    const res = await signIn.email({ email: invited, password }).catch(() => null);
    if (!res || res.error) return setClaimed({ org, signedIn: false });
    router.replace(dashboard(org) as never);
    router.refresh();
  }

  let action: ReactNode;
  if (claimed?.signedIn === false) {
    action = (
      <div role="status" className="flex flex-col gap-3">
        <p className="text-[15px] leading-relaxed text-body">
          {claimed.org.name} is yours. Sign in with {invited} and your new password to manage it.
        </p>
        <Link href={signInHref(dashboard(claimed.org)) as never} className="btn btn-primary btn-lg">
          Sign in
        </Link>
      </div>
    );
  } else if (claimed) {
    action = (
      <p role="status" className="text-center text-[15px] text-body">
        Claimed. Opening your dashboard…
      </p>
    );
  } else if (attaching) {
    action = (
      <p role="status" className="text-center text-[15px] text-body">
        Claiming {info.organization.name}…
      </p>
    );
  } else if (refusal) {
    action = (
      <RefusalNotice
        refusal={refusal}
        invited={invited}
        signedInAs={sessionEmail}
        onSwitch={() => void switchAccount()}
      />
    );
  } else if (sameAccount) {
    action = (
      <button type="button" onClick={() => void attach()} className="btn btn-primary btn-lg">
        Claim as {invited}
      </button>
    );
  } else if (info.hasAccount) {
    action = (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] leading-relaxed text-body">
          <span className="text-ink">{invited}</span> already has an Ekklesia account. Sign in with it to
          claim the page.
        </p>
        <Link href={signInHref(attachPath) as never} className="btn btn-primary btn-lg">
          Sign in to claim
        </Link>
      </div>
    );
  } else {
    action = (
      <PasswordClaim
        token={token}
        info={info}
        attachPath={attachPath}
        onClaimed={(org, password) => void afterPasswordClaim(org, password)}
        onHasAccount={() => setLoad({ s: 'ready', info: { ...info, hasAccount: true } })}
        onGone={(code) => setLoad({ s: 'gone', code })}
      />
    );
  }

  const upcoming = info.events.filter((e) => new Date(e.startsAt).getTime() >= Date.now());

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">Claim your church</span>
        <h1 className="text-[30px] text-strong">{info.organization.name}</h1>
        <p className="text-[15px] leading-relaxed text-body">
          We added this page so people can find your events. Claim it to edit the page, add events
          and see who&rsquo;s coming.
        </p>
      </div>

      <section aria-labelledby="claim-events" className="flex flex-col gap-3">
        <h2 id="claim-events" className="eyebrow text-[11px] text-faint">
          Upcoming events
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-[15px] text-body">None listed yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {upcoming.map((e, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="text-[15px] text-ink">{e.title}</span>
                <span className="text-[13px] text-muted">{fmtDateLong(e.startsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {attachError && (
        <p role="alert" className="error-text">
          {attachError}
        </p>
      )}
      {action}
    </div>
  );
}

function PasswordClaim({
  token,
  info,
  attachPath,
  onClaimed,
  onHasAccount,
  onGone,
}: {
  token: string;
  info: ClaimInfo;
  attachPath: string;
  onClaimed: (org: Claimed, password: string) => void;
  onHasAccount: () => void;
  onGone: (code: GoneCode) => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await apiClient<{ email: string; organization: Claimed }>(
        `/v1/claims/${encodeURIComponent(token)}/password`,
        { method: 'POST', body: { name: name.trim(), password } },
      );
      onClaimed(res.organization, password);
    } catch (err) {
      setPending(false);
      const gone = goneCode(err);
      if (gone) return onGone(gone);
      if (codeOf(err) === 'SIGN_IN') return onHasAccount();
      setError(
        tooMany(err)
          ? TOO_MANY
          : err instanceof ApiError && err.status === 400
            ? err.message
            : 'We couldn’t claim it just now. Please try again.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SocialSignIn callbackURL={attachPath} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-raised px-4 py-3.5 text-[15px]">
          <span className="block text-[13px] text-muted">Your account will use</span>
          <span className="block break-all text-ink">{info.email}</span>
        </div>
        {/* Lets password managers save the new password against this address. */}
        <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
        <Field label="Your name">
          {(p) => (
            <input
              {...p}
              required
              autoComplete="name"
              maxLength={120}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="Create a password" error={error}>
          {(p) => (
            <PasswordInput
              {...p}
              required
              minLength={PASSWORD_MIN}
              maxLength={128}
              autoComplete="new-password"
              placeholder={`${PASSWORD_MIN} characters or more`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <PasswordMeter value={password} summary />
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg mt-2">
          {pending ? 'Claiming…' : 'Claim and create account'}
        </button>
        <p className="text-center text-[12px] leading-relaxed text-faint">
          By claiming you agree to our{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

function RefusalNotice({
  refusal,
  invited,
  signedInAs,
  onSwitch,
}: {
  refusal: AttachRefusal;
  invited: string;
  signedInAs: string | null;
  onSwitch: () => void;
}) {
  if (refusal === 'EMAIL_NOT_VERIFIED') {
    return (
      <p role="alert" className="text-[15px] leading-relaxed text-body">
        Confirm your email address first: open the link we sent to {invited}, then come back to this
        page.
      </p>
    );
  }
  return (
    <div role="alert" className="flex flex-col gap-3">
      <p className="text-[15px] leading-relaxed text-body">
        {refusal === 'STAFF_ACCOUNT'
          ? 'Staff accounts can’t own a church. '
          : `You’re signed in${signedInAs ? ` as ${signedInAs}` : ''}. `}
        This page can only be claimed by <span className="text-ink">{invited}</span>.
      </p>
      <button type="button" onClick={onSwitch} className="btn btn-primary btn-lg">
        Sign in with {invited}
      </button>
    </div>
  );
}

/** A link that can no longer be used, and what to do about it. */
function GoneNotice({
  code,
  token,
  signedIn,
  onGone,
}: {
  code: GoneCode;
  token: string;
  signedIn: boolean;
  onGone: (code: GoneCode) => void;
}) {
  const contact = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline underline-offset-4">
      {SUPPORT_EMAIL}
    </a>
  );
  if (code === 'EXPIRED') return <ExpiredNotice token={token} onGone={onGone} contact={contact} />;
  if (code === 'CLAIMED') {
    return (
      <Notice
        icon="check"
        title="Already claimed"
        body={`This church has already been claimed. If that was you, ${signedIn ? 'manage it from your host dashboard' : 'sign in to manage it'}.`}
        action={
          <Link
            href={(signedIn ? '/organizer' : signInHref('/organizer')) as never}
            className="btn btn-primary btn-lg w-full"
          >
            {signedIn ? 'Open host dashboard' : 'Sign in'}
          </Link>
        }
      />
    );
  }
  if (code === 'USED') {
    return (
      <Notice
        icon="calendarX"
        title="This link has been used or replaced"
        body={
          <>
            If we&rsquo;ve emailed you since, use the link in the newest email. Otherwise, contact us at{' '}
            {contact}.
          </>
        }
      />
    );
  }
  return (
    <Notice
      icon="alert"
      title="This link doesn’t work"
      body={
        <>
          Check you&rsquo;ve opened the whole link from the email. Still stuck? Contact us at {contact}.
        </>
      }
    />
  );
}

function ExpiredNotice({
  token,
  onGone,
  contact,
}: {
  token: string;
  onGone: (code: GoneCode) => void;
  contact: ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function renew() {
    setState('sending');
    setError(null);
    try {
      const res = await apiClient<{ sent: boolean }>(
        `/v1/claims/${encodeURIComponent(token)}/renew`,
        { method: 'POST' },
      );
      setState(res.sent ? 'sent' : 'failed');
    } catch (err) {
      const gone = goneCode(err);
      if (gone && gone !== 'EXPIRED') return onGone(gone);
      // NOT_EXPIRED: it works after all (clock skew) — reload to use it.
      if (codeOf(err) === 'NOT_EXPIRED') return window.location.reload();
      setState('idle');
      setError(tooMany(err) ? TOO_MANY : 'We couldn’t send it just now. Please try again.');
    }
  }

  if (state === 'sent') {
    return (
      <Notice
        icon="mail"
        title="Check your inbox"
        body="We’ve sent a new link to the church’s email address — the one this link went to. It lasts 7 days."
      />
    );
  }
  if (state === 'failed') {
    return (
      <Notice
        icon="alert"
        title="We couldn’t send it"
        body={
          <>
            Something went wrong sending the email. Please contact us at {contact} and we&rsquo;ll send
            you a new link.
          </>
        }
      />
    );
  }
  return (
    <Notice
      icon="clock"
      title="This link has expired"
      body="Claim links last 7 days. We can email a new one to the same address."
      action={
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => void renew()}
            disabled={state === 'sending'}
            className="btn btn-primary btn-lg w-full"
          >
            {state === 'sending' ? 'Sending…' : 'Email me a new link'}
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      }
    />
  );
}

function Notice({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
        <Icon name={icon} size={24} />
      </span>
      <h1 className="text-[26px] text-strong">{title}</h1>
      <p className="text-[15px] leading-relaxed text-body">{body}</p>
      {action}
    </div>
  );
}

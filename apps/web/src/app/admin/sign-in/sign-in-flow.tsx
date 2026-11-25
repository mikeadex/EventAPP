'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import QRCode from 'react-qr-code';
import { Mark } from '@/components/brand';
import { ThemeToggle } from '@/components/client';
import { adminApi, type AdminMe } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import { safeNext } from '@/lib/url';

/*
 * Staff sign-in: password → 6-digit code (or a backup code). A staff account
 * without 2-step yet gets a session from the password alone, which the API
 * refuses with NEEDS_2FA; that account sets 2-step up here before going on.
 *
 * Every outcome is decided by `GET /v1/admin/me`, and this page never sends
 * anyone back to `next` unless that call succeeded — so an account the
 * console turns away cannot bounce between the console and this page.
 */

type Setup = { totpURI: string; secret: string; backupCodes: string[] };

type Step =
  | { kind: 'checking' }
  | { kind: 'account' }
  | { kind: 'code'; method: 'totp' | 'backup' }
  | { kind: 'setup-password' }
  | { kind: 'setup-save'; setup: Setup }
  | { kind: 'setup-verify' }
  | { kind: 'no-access'; signedIn: boolean };

type Access = 'ok' | 'setup' | 'none' | 'signed-out' | 'error';

type AuthError =
  | { status?: number; code?: string; message?: string; lockedUntil?: string }
  | null
  | undefined;

const UNREACHABLE = 'We couldn’t reach the admin service. Check your connection and try again.';

/** Only console paths are honoured as the destination; anything else is /admin. */
function adminNext(raw: string | null): string {
  const next = safeNext(raw, '/admin');
  const path = next.split(/[?#]/)[0]!;
  if (path !== '/admin' && !path.startsWith('/admin/')) return '/admin';
  if (path === '/admin/sign-in' || path.startsWith('/admin/sign-in/')) return '/admin';
  return next;
}

function payloadCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || !('code' in payload)) return undefined;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** What the API says this browser's session may do in the console. */
async function checkAccess(): Promise<Access> {
  try {
    await adminApi<AdminMe>('/me');
    return 'ok';
  } catch (e) {
    if (!(e instanceof ApiError)) return 'error';
    if (e.status === 401) return 'signed-out';
    if (e.status === 403) return payloadCode(e.payload) === 'NEEDS_2FA' ? 'setup' : 'none';
    return 'error';
  }
}

function lockedMessage(lockedUntil: string | undefined): string {
  const until = lockedUntil ? new Date(lockedUntil) : null;
  if (!until || Number.isNaN(until.getTime()))
    return 'Too many attempts. This account is locked for 15 minutes.';
  // Local time, 24-hour, as the site (en-GB) shows times elsewhere.
  const time = until.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Too many attempts. Locked until ${time}.`;
}

/** Messages for errors any auth step can return. Null when the step should word it itself. */
function commonError(err: AuthError): string | null {
  if (!err) return null;
  if (err.status === 423 || err.code === 'LOCKED') return lockedMessage(err.lockedUntil);
  if (err.code === 'USE_STAFF_SIGN_IN') {
    return 'Staff accounts sign in here, with a password and a 2-step code.';
  }
  if (err.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (!err.status) return UNREACHABLE;
  return null;
}

function secretFrom(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------------ */

const inputCls =
  'h-[52px] w-full rounded-full border border-line-2 bg-bg px-5 text-[16px] text-ink outline-none transition-colors focus:border-accent';

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[30px] leading-tight text-strong">{title}</h1>
      {children ? <p className="text-[15px] leading-relaxed text-muted">{children}</p> : null}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[14px] leading-relaxed text-accent">
      {children}
    </p>
  );
}

function StepMarker({ n, label, on }: { n: number; label: string; on: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 text-[13px] ${
        on ? 'text-accent [[data-theme=light]_&]:text-accent-ink' : 'text-muted'
      }`}
      aria-current={on ? 'step' : undefined}
    >
      <b
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] font-normal ${
          on ? 'border-accent bg-soft' : 'border-line-2'
        }`}
      >
        {n}
      </b>
      {label}
    </span>
  );
}

/** A complete code: six digits, no gaps. */
const isFullCode = (code: string) => /^\d{6}$/.test(code);

/**
 * Six one-digit boxes. Typing moves on, backspace moves back, a paste fills
 * them all. `value` keeps a space for an empty box, so a digit typed into a
 * later box stays in that box.
 */
function CodeBoxes({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) =>
    value[i] && value[i] !== ' ' ? value[i]! : '',
  );
  const emit = (next: string[]) =>
    onChange(
      next
        .map((d) => d || ' ')
        .join('')
        .trimEnd(),
    );

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  // Cleared from outside (a wrong code): start again from the first box.
  useEffect(() => {
    if (value === '' && refs.current.includes(document.activeElement as HTMLInputElement)) {
      refs.current[0]?.focus();
    }
  }, [value]);

  function put(from: number, text: string) {
    const incoming = text.replace(/\D/g, '');
    if (!incoming) return;
    const next = digits.slice();
    let i = from;
    for (const d of incoming) {
      if (i > 5) break;
      next[i++] = d;
    }
    emit(next);
    refs.current[Math.min(i, 5)]?.focus();
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = digits.slice();
      if (next[i]) {
        next[i] = '';
      } else if (i > 0) {
        next[i - 1] = '';
        refs.current[i - 1]?.focus();
      }
      emit(next);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    // A whole code fills from the first box, wherever it was pasted.
    put(text.replace(/\D/g, '').length >= 6 ? 0 : i, text);
  }

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">6-digit code</legend>
      <div className="grid grid-cols-6 gap-2.5 max-[760px]:gap-1.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              if (!v) return;
              // A one-time-code autofill can land the whole code in one box.
              put(i, v.length > 1 && !d ? v : v.slice(-1));
            }}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? 6 : 1}
            aria-label={`Digit ${i + 1}`}
            className="h-[60px] w-full min-w-0 rounded-2xl border border-line-2 bg-bg text-center font-mono text-[24px] text-ink outline-none transition-colors focus:border-accent max-[760px]:h-[52px] max-[760px]:text-[20px]"
          />
        ))}
      </div>
    </fieldset>
  );
}

function TrustDevice({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] items-center gap-2.5 text-[14px] text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[18px] w-[18px] accent-[var(--accent)]"
      />
      Trust this device for 7 days
    </label>
  );
}

/* ------------------------------------------------------------------------ */

export function SignInFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = adminNext(params.get('next'));

  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [trust, setTrust] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Leaves this page for the console. The password is no longer needed. */
  function enterConsole() {
    setPassword('');
    router.replace(next as never);
  }

  function toAccount(message: string | null = null) {
    setCode('');
    setBackupCode('');
    setPassword('');
    setError(message);
    setStep({ kind: 'account' });
  }

  async function startSetup(pw: string) {
    const res = await authClient.twoFactor.enable({ password: pw });
    if (res.error) {
      const err = res.error as AuthError;
      if (err?.status === 403) {
        await authClient.signOut().catch(() => undefined);
        setStep({ kind: 'no-access', signedIn: false });
        return;
      }
      setError(
        commonError(err) ??
          (err?.code === 'INVALID_PASSWORD'
            ? 'That password isn’t right.'
            : (err?.message ?? 'Couldn’t start 2-step setup.')),
      );
      setStep({ kind: 'setup-password' });
      return;
    }
    const { totpURI, backupCodes } = res.data;
    setPassword('');
    setSaved(false);
    setCopied(false);
    setCode('');
    setStep({ kind: 'setup-save', setup: { totpURI, secret: secretFrom(totpURI), backupCodes } });
  }

  /**
   * After a session was just created here: go on, set up 2-step, or refuse.
   * An account without staff access is signed straight back out.
   */
  async function afterSession(pw: string) {
    const access = await checkAccess();
    if (access === 'ok') return enterConsole();
    if (access === 'setup') {
      if (pw) return startSetup(pw);
      setStep({ kind: 'setup-password' });
      return;
    }
    if (access === 'none') {
      await authClient.signOut().catch(() => undefined);
      setPassword('');
      setStep({ kind: 'no-access', signedIn: false });
      return;
    }
    if (access === 'signed-out') {
      toAccount('Sign-in didn’t stick. Check that this browser allows cookies, then try again.');
      return;
    }
    toAccount(UNREACHABLE);
  }

  // On arrival: decide once from the current session. Never redirects to
  // `next` unless the console would let this session in.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    void checkAccess().then((access) => {
      if (access === 'ok') router.replace(next as never);
      else if (access === 'setup') setStep({ kind: 'setup-password' });
      else if (access === 'none') setStep({ kind: 'no-access', signedIn: true });
      else if (access === 'signed-out') setStep({ kind: 'account' });
      else toAccount(UNREACHABLE);
    });
  }, [next, router]);

  async function submitAccount(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({ email: email.trim(), password });
    if (res.error) {
      const err = res.error as AuthError;
      setPending(false);
      setError(
        commonError(err) ??
          (err?.code === 'INVALID_EMAIL_OR_PASSWORD'
            ? 'That email and password don’t match.'
            : err?.code === 'EMAIL_NOT_VERIFIED'
              ? 'Confirm your email address before signing in.'
              : (err?.message ?? 'Sign-in failed.')),
      );
      return;
    }
    if (res.data && 'twoFactorRedirect' in res.data && res.data.twoFactorRedirect) {
      setPending(false);
      setPassword('');
      setCode('');
      setBackupCode('');
      setStep({ kind: 'code', method: 'totp' });
      return;
    }
    // A trusted device, or a staff account without 2-step yet.
    await afterSession(password);
    setPending(false);
  }

  async function submitCode(e: FormEvent, method: 'totp' | 'backup') {
    e.preventDefault();
    if (method === 'totp' && !isFullCode(code)) {
      setError('Enter all 6 digits.');
      return;
    }
    setPending(true);
    setError(null);
    const res =
      method === 'totp'
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice: trust })
        : await authClient.twoFactor.verifyBackupCode({
            code: backupCode.trim(),
            trustDevice: trust,
          });
    if (res.error) {
      const err = res.error as AuthError;
      setPending(false);
      if (err?.code === 'INVALID_TWO_FACTOR_COOKIE') {
        toAccount('That took too long. Enter your password again.');
        return;
      }
      setCode('');
      setError(
        commonError(err) ??
          (err?.code === 'INVALID_CODE'
            ? 'That code didn’t work. Check the code in your authenticator app and try again.'
            : err?.code === 'INVALID_BACKUP_CODE'
              ? 'That backup code didn’t work. Each one works once.'
              : (err?.message ?? 'Couldn’t check that code.')),
      );
      return;
    }
    await afterSession('');
    setPending(false);
  }

  async function submitSetupPassword(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    await startSetup(password);
    setPending(false);
  }

  async function submitSetupCode(e: FormEvent) {
    e.preventDefault();
    if (!isFullCode(code)) {
      setError('Enter all 6 digits.');
      return;
    }
    setPending(true);
    setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code });
    if (res.error) {
      const err = res.error as AuthError;
      setPending(false);
      setCode('');
      setError(
        commonError(err) ??
          (err?.code === 'INVALID_CODE'
            ? 'That code didn’t work. Check your authenticator app shows Ekklesia Admin and try again.'
            : (err?.message ?? 'Couldn’t check that code.')),
      );
      return;
    }
    await afterSession('');
    setPending(false);
  }

  async function signOutHere() {
    setPending(true);
    await authClient.signOut().catch(() => undefined);
    setPending(false);
    toAccount();
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const isSetup =
    step.kind === 'setup-password' || step.kind === 'setup-save' || step.kind === 'setup-verify';
  const onStep2 = step.kind === 'code' || isSetup;

  let body: ReactNode;
  switch (step.kind) {
    case 'checking':
      body = (
        <p role="status" className="text-[14px] text-muted">
          Checking your access…
        </p>
      );
      break;

    case 'account':
      body = (
        <form className="flex flex-col gap-5" onSubmit={submitAccount}>
          <Heading title="Staff sign in">
            For the Ekklesia team only. Use your @ekklesiaevents.com account.
          </Heading>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-2">Work email</span>
            <input
              className={inputCls}
              type="email"
              autoComplete="username"
              placeholder="name@ekklesiaevents.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="flex items-center justify-between">
              <label htmlFor="staff-password" className="text-[13px] text-ink-2">
                Password
              </label>
              <Link
                href={
                  `/reset-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}` as never
                }
                className="-my-3 py-3 text-[13px] text-accent"
              >
                Forgotten it?
              </Link>
            </span>
            <input
              id="staff-password"
              className={inputCls}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <button type="submit" disabled={pending} className="btn btn-primary h-[52px] text-[16px]">
            {pending ? 'Checking…' : 'Continue'}
          </button>
        </form>
      );
      break;

    case 'code': {
      const backup = step.method === 'backup';
      body = (
        <form className="flex flex-col gap-5" onSubmit={(e) => void submitCode(e, step.method)}>
          {backup ? (
            <Heading title="Enter a backup code">
              Use one of the backup codes you saved when you set up 2-step. Each code works once.
            </Heading>
          ) : (
            <Heading title="Enter your code">
              Open your authenticator app and enter the 6-digit code for{' '}
              <span className="text-ink">Ekklesia Admin</span>.
            </Heading>
          )}
          {backup ? (
            <label className="flex flex-col gap-2">
              <span className="text-[13px] text-ink-2">Backup code</span>
              <input
                className={`${inputCls} font-mono`}
                autoComplete="one-time-code"
                autoCapitalize="off"
                spellCheck={false}
                required
                autoFocus
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
              />
            </label>
          ) : (
            <CodeBoxes value={code} onChange={setCode} autoFocus />
          )}
          <TrustDevice checked={trust} onChange={setTrust} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <button type="submit" disabled={pending} className="btn btn-primary h-[52px] text-[16px]">
            {pending ? 'Checking…' : 'Verify and sign in'}
          </button>
          <span className="flex flex-wrap justify-between gap-x-3 text-[14px]">
            <button type="button" className="min-h-[44px] text-ink-2" onClick={() => toAccount()}>
              ← Use a different account
            </button>
            <button
              type="button"
              className="min-h-[44px] text-accent"
              onClick={() => {
                setError(null);
                setStep({ kind: 'code', method: backup ? 'totp' : 'backup' });
              }}
            >
              {backup ? 'Use your authenticator app' : 'Use a backup code'}
            </button>
          </span>
        </form>
      );
      break;
    }

    case 'setup-password':
      body = (
        <form className="flex flex-col gap-5" onSubmit={submitSetupPassword}>
          <Heading title="Set up 2-step verification">
            Every staff account needs a code from an authenticator app as well as a password. Enter
            your password again to start.
          </Heading>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] text-ink-2">Password</span>
            <input
              className={inputCls}
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <button type="submit" disabled={pending} className="btn btn-primary h-[52px] text-[16px]">
            {pending ? 'Checking…' : 'Continue'}
          </button>
          <button
            type="button"
            className="min-h-[44px] self-start text-[14px] text-ink-2"
            onClick={() => void signOutHere()}
          >
            ← Use a different account
          </button>
        </form>
      );
      break;

    case 'setup-save': {
      const { setup } = step;
      body = (
        <div className="flex flex-col gap-5">
          <Heading title="Scan this code">
            In your authenticator app (Google Authenticator, 1Password, Authy…), add an account and
            scan the code.
          </Heading>
          <div className="self-center rounded-2xl bg-white p-3">
            <QRCode
              value={setup.totpURI}
              size={184}
              level="M"
              bgColor="var(--qr-bg)"
              fgColor="var(--qr-ink)"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-ink-2">Can’t scan it? Enter this key instead</span>
            <code className="select-all break-all rounded-2xl border border-line bg-bg px-4 py-3 font-mono text-[15px] tracking-[0.08em] text-ink">
              {setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret}
            </code>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <h2 className="text-[18px] text-strong">Save your backup codes</h2>
            <p className="text-[14px] leading-relaxed text-muted">
              If you lose your phone, each of these codes signs you in once. Keep them somewhere
              safe — they won’t be shown again.
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl border border-line bg-bg px-4 py-3 font-mono text-[14px] text-ink">
              {setup.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-outline self-start"
              onClick={() => void copyCodes(setup.backupCodes)}
            >
              {copied ? 'Copied' : 'Copy codes'}
            </button>
            <label className="flex min-h-[44px] items-center gap-2.5 text-[14px] text-ink-2">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="h-[18px] w-[18px] accent-[var(--accent)]"
              />
              I’ve saved these backup codes
            </label>
          </div>
          <button
            type="button"
            disabled={!saved}
            className="btn btn-primary h-[52px] text-[16px]"
            onClick={() => {
              setError(null);
              setCode('');
              setStep({ kind: 'setup-verify' });
            }}
          >
            Continue
          </button>
        </div>
      );
      break;
    }

    case 'setup-verify':
      body = (
        <form className="flex flex-col gap-5" onSubmit={submitSetupCode}>
          <Heading title="Enter your code">
            Enter the 6-digit code your authenticator app now shows for{' '}
            <span className="text-ink">Ekklesia Admin</span> to turn 2-step on.
          </Heading>
          <CodeBoxes value={code} onChange={setCode} autoFocus />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <button type="submit" disabled={pending} className="btn btn-primary h-[52px] text-[16px]">
            {pending ? 'Checking…' : 'Turn on 2-step and continue'}
          </button>
        </form>
      );
      break;

    case 'no-access':
      body = (
        <div className="flex flex-col gap-5">
          <Heading title="No staff access">
            This account doesn’t have staff access. Sign in with your @ekklesiaevents.com staff
            account.
          </Heading>
          {step.signedIn ? (
            <button
              type="button"
              disabled={pending}
              className="btn btn-primary h-[52px] text-[16px]"
              onClick={() => void signOutHere()}
            >
              {pending ? 'Signing out…' : 'Sign out and use a staff account'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary h-[52px] text-[16px]"
              onClick={() => toAccount()}
            >
              Use a different account
            </button>
          )}
        </div>
      );
      break;
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-16"
      style={{
        background:
          'radial-gradient(900px 500px at 50% -10%, rgba(var(--accent-rgb), .12), transparent 70%), var(--bg)',
      }}
    >
      <div className="flex w-full max-w-[460px] flex-col gap-7">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-3">
            <Mark size={34} />
            <span className="flex flex-col leading-none">
              <span className="text-[22px] text-strong">ekklesia</span>
              <span className="mt-1 pl-[2px] text-[9px] tracking-[0.52em] text-accent">ADMIN</span>
            </span>
          </span>
          <ThemeToggle className="!h-11 !w-11" />
        </div>

        <main className="card flex flex-col gap-6 p-9 shadow-[var(--shadow)] max-[760px]:p-6">
          {step.kind !== 'checking' && step.kind !== 'no-access' ? (
            <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Sign-in steps">
              <StepMarker n={1} label="Your account" on={!onStep2} />
              <StepMarker
                n={2}
                label={isSetup ? 'Set up 2-step' : 'Verify it’s you'}
                on={onStep2}
              />
            </div>
          ) : null}
          {body}
        </main>

        <div className="flex flex-col items-center gap-2.5 text-center">
          <p className="text-[13px] leading-relaxed text-muted">
            Sign-ins are logged with your IP address and device. After 5 wrong attempts the account
            is locked for 15 minutes.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex min-h-[44px] items-center text-[14px] text-accent"
          >
            Looking for your Ekklesia account? Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}

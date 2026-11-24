'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendVerificationEmail, signIn, useSession, webUrl } from '@/lib/auth-client';
import { safeNext } from '@/lib/url';
import { Field, PasswordInput } from '@/components/controls';
import { SocialSignIn } from '@/components/social-sign-in';

type Step = 'start' | 'password';

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: session } = useSession();

  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  // On by default, matching what sign-in always did (a 30-day session). Off
  // gives a session that ends when the browser closes — for shared computers.
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set only for EMAIL_NOT_VERIFIED, so the offer to resend appears exactly
  // when it is the thing standing in the way.
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  // An account made through Google or Apple has no password, so a password
  // attempt on one fails exactly like a wrong password. The hint names that
  // possibility without confirming the address exists or which method it uses.
  const [maybeSocial, setMaybeSocial] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Already signed in (e.g. the back button): go where they were heading.
  useEffect(() => {
    if (session?.user && !pending) router.replace(next as never);
  }, [session?.user, pending, next, router]);

  useEffect(() => {
    if (step === 'password') passwordRef.current?.focus();
  }, [step]);

  function toPassword(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setStep('password');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setUnverified(false);
    setResent(false);
    setMaybeSocial(false);
    const res = await signIn.email({ email: email.trim(), password, rememberMe: remember });
    if (res.error) {
      setPending(false);
      const code = (res.error as { code?: string }).code;
      const notVerified = code === 'EMAIL_NOT_VERIFIED';
      setUnverified(notVerified);
      setMaybeSocial(!notVerified);
      setError(
        notVerified
          ? 'Confirm your email before signing in. Check your inbox for the link.'
          : (res.error.message ?? 'Sign-in failed'),
      );
      return;
    }
    // Honour ?next= — it used to be ignored, so every "sign in to RSVP"
    // dropped people on the home page instead of back at the event.
    router.replace(next as never);
    router.refresh();
  }

  /** Without this, losing the confirmation email leaves the account unusable. */
  async function resend() {
    setPending(true);
    await sendVerificationEmail({ email: email.trim(), callbackURL: webUrl(next) }).catch(() => {
      /* Same generic outcome either way — never reveal whether the address exists. */
    });
    setPending(false);
    setResent(true);
  }

  const signUpHref = `/sign-up${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  const terms = (
    <p className="mt-7 text-center text-[12px] leading-relaxed text-faint">
      By continuing you agree to our{' '}
      <Link href="/terms" className="underline">
        Terms
      </Link>{' '}
      and{' '}
      <Link href="/privacy" className="underline">
        Privacy Policy
      </Link>
      .
    </p>
  );

  if (step === 'start') {
    return (
      <div>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-[30px] text-strong">Welcome back</h1>
          <p className="text-[15px] text-body">Sign in to see your tickets and saved events.</p>
        </div>
        <div className="mt-7 flex flex-col gap-3">
          <SocialSignIn callbackURL={next} />
          <form onSubmit={toPassword} className="flex flex-col gap-3">
            <Field label="Email address">
              {(p) => (
                <input
                  {...p}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <button type="submit" className="btn btn-primary btn-lg">
              Continue with email
            </button>
          </form>
          {/* TODO(confirm): the design offers "Email me a sign-in code instead".
              The API has no email-code sign-in (Better Auth's emailOTP plugin
              isn't enabled), so it's left out until that exists. */}
          <p className="mt-2 text-center text-[14px] text-ink-2">
            New here?{' '}
            <Link href={signUpHref as never} className="text-accent">
              Create an account
            </Link>
          </p>
        </div>
        {terms}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 text-center">
        <span className="eyebrow text-accent">Sign in</span>
        <h1 className="text-[30px] text-strong">Enter your password</h1>
      </div>
      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-raised px-4 py-3.5 text-[15px]">
          <span className="truncate">{email}</span>
          <button
            type="button"
            onClick={() => {
              setStep('start');
              setPassword('');
              setError(null);
            }}
            className="text-[14px] text-accent"
          >
            Change
          </button>
        </div>
        {/* Hidden username keeps password managers pairing the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <Field
          label="Password"
          error={error}
          aside={
            <Link
              href={`/reset-password?email=${encodeURIComponent(email)}` as never}
              className="text-[14px] text-accent"
            >
              Forgot password?
            </Link>
          }
        >
          {(p) => (
            <PasswordInput
              {...p}
              ref={passwordRef}
              autoComplete="current-password"
              required
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {maybeSocial && (
          <p className="text-[13px] leading-relaxed text-muted">
            If you created this account with Google or Apple, go back and sign in that way — those
            accounts don&rsquo;t have a password.
          </p>
        )}
        {unverified && !resent && (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={pending}
            className="self-start text-[14px] text-accent disabled:opacity-60"
          >
            Resend confirmation email
          </button>
        )}
        {resent && <p className="text-[14px] text-body">Confirmation email sent — check your inbox.</p>}
        <label className="flex items-center gap-2.5 text-[14px] text-ink-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-[18px] w-[18px] accent-[var(--accent)]"
          />
          Keep me signed in on this device
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-[14px] text-ink-2">
          New here?{' '}
          <Link href={signUpHref as never} className="text-accent">
            Create an account
          </Link>
        </p>
      </form>
      {terms}
    </div>
  );
}

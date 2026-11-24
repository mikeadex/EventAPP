'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUp, webUrl } from '@/lib/auth-client';
import { safeNext } from '@/lib/url';
import { Field, PasswordInput } from '@/components/controls';
import { Icon } from '@/components/icons';
import { PASSWORD_MIN, PasswordMeter } from '@/components/password-meter';
import { SocialSignIn } from '@/components/social-sign-in';

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return;
    }
    setPending(true);
    setError(null);
    // Absolute: a relative callbackURL would resolve against the API host, so
    // the verification link would land people on the API instead of here.
    // Accounts hold one display name (mobile sends one too), so the two
    // fields are joined. Last name is optional — not everyone has two.
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    const res = await signUp.email({ email: email.trim(), password, name, callbackURL: webUrl(next) });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'We couldn’t create your account.');
      return;
    }
    // Verification is required, so sign-up returns no session. Say an email is
    // waiting rather than dropping them somewhere silently signed out.
    if (!res.data?.token) {
      setCheckYourEmail(true);
      return;
    }
    router.replace(next as never);
    router.refresh();
  }

  const signInHref = `/sign-in${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;

  if (checkYourEmail) {
    return (
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
          <Icon name="mail" size={24} />
        </span>
        <h1 className="text-[30px] text-strong">Check your email</h1>
        <p className="text-[15px] leading-relaxed text-body">
          We&rsquo;ve sent a confirmation link to <span className="text-ink">{email}</span>. Open it to finish
          setting up your account.
        </p>
        <p className="text-[13px] leading-relaxed text-muted">
          The link lasts 24 hours. Nothing there? Check spam — or try signing in, which offers to send
          another.
        </p>
        <Link href={signInHref as never} className="btn btn-outline btn-lg mt-2 w-full">
          Go to sign in
        </Link>
      </div>
    );
  }

  const terms = (
    <p className="text-center text-[12px] leading-relaxed text-faint">
      By creating an account you agree to our{' '}
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

  return (
    <div data-auth-wide>
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">Create account</span>
        <h1 className="text-[30px] text-strong">Set up your account</h1>
        <p className="text-[15px] text-body">Takes about a minute.</p>
      </div>
      <div className="mt-7 flex flex-col gap-4">
        <SocialSignIn callbackURL={next} />
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              {(p) => (
                <input
                  {...p}
                  required
                  autoComplete="given-name"
                  maxLength={60}
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Last name">
              {(p) => (
                <input
                  {...p}
                  autoComplete="family-name"
                  maxLength={60}
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label="Email address">
            {(p) => (
              <input
                {...p}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Password" error={error}>
            {(p) => (
              <PasswordInput
                {...p}
                required
                minLength={PASSWORD_MIN}
                autoComplete="new-password"
                placeholder={`${PASSWORD_MIN} characters or more`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <PasswordMeter value={password} summary />
          <button type="submit" disabled={pending} className="btn btn-primary btn-lg mt-4">
            {pending ? 'Creating account…' : 'Create account'}
          </button>
          {terms}
          <p className="text-center text-[14px] text-ink-2">
            Already have one?{' '}
            <Link href={signInHref as never} className="text-accent">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

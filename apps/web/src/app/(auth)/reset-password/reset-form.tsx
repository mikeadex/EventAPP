'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { requestPasswordReset, resetPassword, webUrl } from '@/lib/auth-client';
import { Field, PasswordInput } from '@/components/controls';
import { Icon } from '@/components/icons';
import { PASSWORD_MIN, PasswordMeter } from '@/components/password-meter';

/**
 * One page, two halves: without a token it asks for an email and sends the
 * link; the link brings people back here with ?token= to choose a new one.
 * Better Auth redirects with ?error=INVALID_TOKEN when the link is stale.
 */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const linkError = params.get('error');

  if (linkError) {
    return (
      <Done
        icon="alert"
        title="That link has expired"
        body="Reset links work once and only for a short time. Ask for a new one below."
        action={
          <Link href="/reset-password" className="btn btn-primary btn-lg w-full">
            Send a new link
          </Link>
        }
      />
    );
  }
  return token ? <ChooseNew token={token} /> : <RequestLink initialEmail={params.get('email') ?? ''} />;
}

function RequestLink({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    // The outcome is the same whether or not the address has an account, so
    // this page can't be used to find out who is signed up.
    await requestPasswordReset({ email: email.trim(), redirectTo: webUrl('/reset-password') }).catch(() => {});
    setPending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Done
        icon="mail"
        title="Check your email"
        body={`If ${email} has an Ekklesia account with a password, a reset link is on its way.`}
        note="Signed up with Google or Apple? Those accounts have no password — sign in that way instead."
        action={
          <Link href="/sign-in" className="btn btn-outline btn-lg w-full">
            Back to sign in
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-[30px] text-strong">Reset your password</h1>
        <p className="text-[15px] text-body">Enter your email and we&rsquo;ll send you a link to choose a new one.</p>
      </div>
      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
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
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
          {pending ? 'Sending…' : 'Send reset link'}
        </button>
        <Link href="/sign-in" className="text-center text-[14px] text-accent">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}

function ChooseNew({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`Use at least ${PASSWORD_MIN} characters.`);
    if (password !== confirm) return setError('The two passwords don’t match.');
    setPending(true);
    setError(null);
    const res = await resetPassword({ newPassword: password, token });
    setPending(false);
    if (res.error) {
      setError(
        res.error.code === 'INVALID_TOKEN'
          ? 'This link has expired. Ask for a new one.'
          : (res.error.message ?? 'We couldn’t reset your password.'),
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Done
        icon="check"
        title="Password updated"
        body="You can sign in with your new password now."
        action={
          <Link href="/sign-in" className="btn btn-primary btn-lg w-full">
            Sign in
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-[30px] text-strong">Choose a new password</h1>
        <p className="text-[15px] text-body">You&rsquo;ll use it to sign in from now on.</p>
      </div>
      <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
        <Field label="New password">
          {(p) => (
            <PasswordInput
              {...p}
              required
              minLength={PASSWORD_MIN}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <PasswordMeter value={password} />
        <Field label="Confirm new password" error={error}>
          {(p) => (
            <PasswordInput
              {...p}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
          {pending ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}

function Done({
  icon,
  title,
  body,
  note,
  action,
}: {
  icon: 'mail' | 'check' | 'alert';
  title: string;
  body: string;
  note?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center" role="status">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line-3 bg-soft text-accent">
        <Icon name={icon} size={24} />
      </span>
      <h1 className="text-[30px] text-strong">{title}</h1>
      <p className="text-[15px] leading-relaxed text-body">{body}</p>
      {note && <p className="text-[13px] leading-relaxed text-muted">{note}</p>}
      <div className="mt-2 w-full">{action}</div>
    </div>
  );
}

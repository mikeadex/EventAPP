'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/social-sign-in';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signUp.email({ email, password, name });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Sign-up failed');
      return;
    }
    // Signing up no longer signs you in: verification is required, so the
    // response carries a null token. Navigating here would drop someone on the
    // home page silently signed out, with nothing saying an email is waiting —
    // they then try to sign in and are told their email is not verified.
    if (!res.data?.token) {
      setCheckYourEmail(true);
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (checkYourEmail) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink-900">Check your email</h1>
        <p className="mt-3 text-ink-700">
          We&rsquo;ve sent a verification link to <strong>{email}</strong>. Click it to finish
          setting up your account, then sign in.
        </p>
        <p className="mt-3 text-sm text-ink-500">
          The link lasts 24 hours. If it doesn&rsquo;t arrive, check your spam folder — or try
          signing in, which will offer to send another.
        </p>
        <Link href="/sign-in" className="mt-6 inline-block underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink-900">Create your account</h1>
      <p className="mt-1 text-sm text-ink-500">
        Free for attendees. Verification required to publish or accept payments.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <span className="mt-1 block text-xs text-ink-400">
            At least 12 characters.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-600 px-4 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <SocialSignIn />

      <p className="mt-6 text-sm text-ink-500">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

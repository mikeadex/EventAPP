'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from '@/lib/auth-client';

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-display text-xl text-ink-900">
          Ekklesia
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-700">
          <Link href="/events" className="hover:text-ink-900">
            Events
          </Link>
          {!isPending && session?.user ? (
            <>
              <Link href="/me/tickets" className="hover:text-ink-900">
                My tickets
              </Link>
              <Link href="/organizer" className="hover:text-ink-900">
                Organizer
              </Link>
              <span className="text-ink-400">{session.user.name ?? session.user.email}</span>
              <button
                onClick={handleSignOut}
                className="rounded-md border border-ink-200 px-3 py-1.5 text-sm hover:bg-ink-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-ink-900">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

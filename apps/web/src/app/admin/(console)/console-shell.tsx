'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AdminNav, type AdminSection } from '@/components/admin/admin-nav';
import { AdminMeProvider } from '@/components/admin/admin-me';
import { AdminTop } from '@/components/admin/admin-top';
import { adminApi, type AdminMe } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';
import { signOut } from '@/lib/auth-client';

type Gate = { state: 'checking' } | { state: 'ok'; me: AdminMe } | { state: 'error'; message: string };

function sectionFor(pathname: string): AdminSection | undefined {
  if (pathname === '/admin') return 'overview';
  for (const s of ['reports', 'hosts', 'events'] as const) {
    if (pathname === `/admin/${s}` || pathname.startsWith(`/admin/${s}/`)) return s;
  }
  return undefined;
}

/**
 * Where a refused `GET /v1/admin/me` sends the visitor. The API answers 401
 * when signed out, a code-less 403 for an ordinary account, and 403 with a
 * code for a staff-role holder who is not cleared yet. Only NEEDS_2FA has a
 * step of its own; everything else starts sign-in again.
 */
function signInRedirect(err: ApiError): string {
  const code =
    err.payload && typeof err.payload === 'object' && 'code' in err.payload
      ? (err.payload as { code?: unknown }).code
      : undefined;
  if (err.status === 403 && code === 'NEEDS_2FA') return '/admin/sign-in?step=setup';
  const here = `${window.location.pathname}${window.location.search}`;
  return `/admin/sign-in?next=${encodeURIComponent(here)}`;
}

/**
 * Client-checked guard + console chrome. Nothing of the console renders until
 * the API confirms a cleared staff session; the API re-checks on every call.
 */
export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [gate, setGate] = useState<Gate>({ state: 'checking' });
  const [reportCount, setReportCount] = useState<number | undefined>();

  const check = useCallback(async () => {
    setGate({ state: 'checking' });
    try {
      const me = await adminApi<AdminMe>('/me');
      setGate({ state: 'ok', me });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        router.replace(signInRedirect(e) as never);
        return;
      }
      setGate({ state: 'error', message: 'We couldn’t reach the admin service. Check your connection and try again.' });
    }
  }, [router]);

  useEffect(() => {
    void check();
  }, [check]);

  // Open-report badge. Refreshed on navigation so it catches up after a
  // report is handled. Roles without the queue get a 403 here: no badge.
  const signedIn = gate.state === 'ok';
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    adminApi<{ OPEN?: number }>('/reports/counts')
      .then((c) => live && setReportCount(c.OPEN))
      .catch(() => live && setReportCount(undefined));
    return () => {
      live = false;
    };
  }, [signedIn, pathname]);

  const onSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      router.replace('/admin/sign-in' as never);
    }
  }, [router]);

  if (gate.state !== 'ok') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg p-6">
        {gate.state === 'checking' ? (
          <p className="text-[14px] text-muted" role="status">
            Checking your access…
          </p>
        ) : (
          <div className="card flex max-w-[420px] flex-col items-start gap-4 p-6" role="alert">
            <p className="text-[15px] text-body">{gate.message}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void check()}>
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="adm">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="adm-side">
        <AdminNav
          active={sectionFor(pathname)}
          counts={{ reports: reportCount }}
          staff={gate.me}
          onSignOut={() => void onSignOut()}
        />
      </aside>
      <div className="adm-main">
        <AdminTop onSignOut={() => void onSignOut()} />
        <main id="main" className="adm-body">
          <AdminMeProvider value={gate.me}>{children}</AdminMeProvider>
        </main>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { HostShell } from '@/components/host/host-shell';

export const metadata: Metadata = {
  title: { default: 'Host dashboard', template: '%s · Ekklesia hosts' },
  robots: { index: false },
};

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Suspense fallback={null}>
          <HostShell>{children}</HostShell>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

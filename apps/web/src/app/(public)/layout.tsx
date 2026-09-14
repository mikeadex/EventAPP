import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { AuthResultBanner } from '@/components/auth-result-banner';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {/* useSearchParams needs a Suspense boundary or it opts the whole tree
          into client-side rendering. */}
      <Suspense fallback={null}>
        <AuthResultBanner />
      </Suspense>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

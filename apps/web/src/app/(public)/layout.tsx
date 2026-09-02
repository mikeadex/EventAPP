import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { AuthResultBanner } from '@/components/auth-result-banner';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* useSearchParams needs a Suspense boundary or it opts the whole tree
          into client-side rendering. */}
      <Suspense fallback={null}>
        <AuthResultBanner />
      </Suspense>
      {children}
    </>
  );
}

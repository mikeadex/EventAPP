import Link from 'next/link';
import { Mark } from '@/components/brand';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main id="main" className="wrap flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
        <Mark size={64} />
        <span className="eyebrow text-accent">404</span>
        <h1 className="h1">We couldn’t find that page</h1>
        <p className="lead max-w-[480px]">
          The link may be old, or the event may have been unpublished by its host.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/events" className="btn btn-primary btn-lg">
            Discover events
          </Link>
          <Link href="/" className="btn btn-outline btn-lg">
            Home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: { default: 'Platform admin', template: '%s · Ekklesia admin' },
  robots: { index: false },
};

// Only pages that exist. The old nav also listed organisations, users,
// feature flags and an audit log — all 404s.
const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/reports', label: 'Reports' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main id="main" className="wrap grid flex-1 items-start gap-8 py-10 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Admin" className="flex gap-2 md:flex-col">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href as never} className="chip md:justify-start">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}

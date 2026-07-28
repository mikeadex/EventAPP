import Link from 'next/link';

export const metadata = {
  title: 'Platform admin',
};

const nav = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/organizations', label: 'Organizations' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/feature-flags', label: 'Feature flags' },
  { href: '/admin/audit', label: 'Audit log' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-ink-100 bg-ink-900 p-6 text-ink-50">
        <p className="font-display text-lg">Ekklesia</p>
        <p className="text-xs uppercase tracking-wider text-ink-300">Platform admin</p>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href as never}
              className="rounded-md px-3 py-2 text-sm text-ink-100 hover:bg-ink-800"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}

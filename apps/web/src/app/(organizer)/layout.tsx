import Link from 'next/link';

export const metadata = {
  title: 'Organizer console',
};

const nav = [
  { href: '/organizer', label: 'Overview' },
  { href: '/organizer/events', label: 'Events' },
  { href: '/organizer/attendees', label: 'Attendees' },
  { href: '/organizer/payouts', label: 'Payouts' },
  { href: '/organizer/staff', label: 'Staff' },
  { href: '/organizer/settings', label: 'Settings' },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-ink-100 bg-white p-6">
        <p className="font-display text-lg text-ink-900">Ekklesia</p>
        <p className="text-xs uppercase tracking-wider text-ink-400">Organizer</p>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href as never}
              className="rounded-md px-3 py-2 text-sm text-ink-700 hover:bg-ink-100"
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

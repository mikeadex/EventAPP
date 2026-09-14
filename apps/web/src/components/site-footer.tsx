import Link from 'next/link';

/**
 * Makes the legal and support pages reachable.
 *
 * They existed but nothing linked to them, so they could only be found by
 * typing the URL. Both stores require a reachable privacy policy and support
 * page, and a reviewer looks for them — but the better reason is that someone
 * wanting to know what happens to their data should not have to guess a path.
 */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-ink-500">
        <p>© {new Date().getFullYear()} Ekklesia Events</p>
        <nav className="flex flex-wrap gap-6">
          <Link href="/support" className="hover:text-ink-900">
            Support
          </Link>
          <Link href="/privacy" className="hover:text-ink-900">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink-900">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}

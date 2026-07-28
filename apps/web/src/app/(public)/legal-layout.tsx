/**
 * Shared shell for the legal pages (/privacy, /terms).
 *
 * These pages must stay reachable at stable public URLs: both the App Store
 * and Google Play require a privacy policy URL on the store listing, and the
 * mobile app links here from Settings → About.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl text-ink-900">{title}</h1>
      <p className="mt-3 text-sm text-ink-500">Last updated {updated}</p>
      <div className="mt-10 space-y-8 text-ink-700 leading-relaxed">{children}</div>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-ink-900">{heading}</h2>
      {children}
    </section>
  );
}

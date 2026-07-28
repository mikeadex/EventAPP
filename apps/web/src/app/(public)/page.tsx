import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <section className="py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-brand-600">
          Ekklesia
        </p>
        <h1 className="mt-4 font-display text-5xl text-ink-900 md:text-6xl">
          Find a gathering. <span className="text-brand-600">Build a community.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-600">
          The marketplace for church and faith-community events. Discover services,
          conferences, youth nights, small groups and more — across the UK, EU, and US.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/events"
            className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Browse events
          </Link>
          <Link
            href="/organizers"
            className="rounded-lg border border-ink-200 px-6 py-3 font-medium text-ink-800 hover:bg-ink-100"
          >
            For organizers
          </Link>
        </div>
      </section>
    </main>
  );
}

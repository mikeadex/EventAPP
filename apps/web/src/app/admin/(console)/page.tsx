import Link from 'next/link';

// Absolute: a layout's title template only reaches child segments, not its own page.
export const metadata = { title: { absolute: 'Overview · Ekklesia admin' } };

/** Placeholder until the Overview slice: headline numbers, queues and activity. */
export default function AdminOverviewPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">Admin</span>
        <h1 className="h1 !text-[40px]">Overview</h1>
        <p className="text-[15px] text-ink-2">Overview is coming. Until then, start from a queue.</p>
      </div>
      <Link href="/admin/reports" className="btn btn-outline w-fit">
        Go to reports
      </Link>
    </>
  );
}

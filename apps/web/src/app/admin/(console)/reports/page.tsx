import { ReportQueue } from './report-queue';

export const metadata = { title: 'Reports' };

export default function AdminReportsPage() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex max-w-2xl flex-col gap-2">
        <span className="eyebrow text-accent">Review queue</span>
        <h1 className="h1 !text-[40px]">Reports</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Things attendees have flagged about events, hosts or other users. Our Terms commit us to acting on
          objectionable content within 24 hours, so the oldest are first.
        </p>
      </div>
      <ReportQueue />
    </div>
  );
}

import { ReportQueue } from './report-queue';

export const metadata = { title: 'Reports' };

export default function AdminReportsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-3">
        <span className="eyebrow text-accent">Platform admin</span>
        <h1 className="h1 !text-[44px]">Reports</h1>
        <p className="text-[15px] leading-relaxed text-body">
          Our Terms commit us to reviewing every report and acting on objectionable content within 24 hours. Oldest
          first — the top of the list is closest to that deadline.
        </p>
      </div>
      <ReportQueue />
    </div>
  );
}

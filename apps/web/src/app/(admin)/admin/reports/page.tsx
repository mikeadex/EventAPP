import { ReportQueue } from './report-queue';

export const metadata = {
  title: 'Reports',
};

export default function AdminReportsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink-900">Reports</h1>
      <p className="mt-2 text-ink-500">
        Our Terms commit us to reviewing every report and acting on objectionable content within 24
        hours. Oldest first — the top of the list is closest to that deadline.
      </p>
      <ReportQueue />
    </div>
  );
}

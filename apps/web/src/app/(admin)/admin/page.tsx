import Link from 'next/link';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Platform admin' };

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-accent">Platform admin</span>
        <h1 className="h1 !text-[44px]">Overview</h1>
      </div>
      <Link href="/admin/reports" className="card card-link flex max-w-[480px] items-center gap-4 p-6">
        <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full border border-line-2 text-accent">
          <Icon name="alert" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-[18px] text-strong">Reports</span>
          <span className="text-[14px] text-body">Review reported events, hosts and people within 24 hours.</span>
        </span>
      </Link>
    </div>
  );
}

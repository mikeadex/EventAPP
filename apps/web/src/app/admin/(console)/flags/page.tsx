import { FlagList } from './flag-list';

export const metadata = { title: 'Feature flags' };

export default function AdminFlagsPage() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex max-w-2xl flex-col gap-2">
        <span className="eyebrow text-accent">Platform</span>
        <h1 className="h1 !text-[40px]">Feature flags</h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          What the apps are allowed to offer. A change applies on the next request, with no deploy. The platform
          switch covers everyone; an organisation override wins over it for that organisation alone.
        </p>
      </div>
      <FlagList />
    </div>
  );
}

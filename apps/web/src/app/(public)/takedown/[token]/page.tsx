import type { Metadata } from 'next';
import { TakedownForm } from './takedown-form';

// The URL carries a working take-down token: never index it, never send it on.
export const metadata: Metadata = {
  title: 'Take down your church page',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<{ token: string }>;

export default async function TakedownPage({ params }: { params: Params }) {
  const { token } = await params;
  return (
    <div className="wrap pb-8 pt-12 sm:pt-16">
      <div className="panel mx-auto max-w-[560px] !rounded-hero p-7 sm:p-9">
        <TakedownForm token={token} />
      </div>
    </div>
  );
}

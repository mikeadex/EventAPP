import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from './account-view';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="wrap max-w-[1040px] py-12">
      <Suspense fallback={null}>
        <AccountView />
      </Suspense>
    </div>
  );
}

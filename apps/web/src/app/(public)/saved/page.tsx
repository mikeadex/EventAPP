import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SavedList } from './saved-list';

export const metadata: Metadata = { title: 'Saved events', robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="wrap pt-12">
      <Suspense fallback={null}>
        <SavedList />
      </Suspense>
    </div>
  );
}

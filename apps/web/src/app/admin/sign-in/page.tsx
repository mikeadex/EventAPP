import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInFlow } from './sign-in-flow';

export const metadata: Metadata = {
  title: { absolute: 'Staff sign in · Ekklesia admin' },
  robots: { index: false, follow: false },
};

/** Staff sign-in. Outside the console route group, so it has no shell or guard. */
export default function AdminSignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInFlow />
    </Suspense>
  );
}

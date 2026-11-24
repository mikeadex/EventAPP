import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/** Sign in, sign up and password reset: one glowing card under the header. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader />
      <main id="main" className="relative flex-1 overflow-hidden px-5 pb-24 pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-120px] h-[760px] w-[760px] -translate-x-1/2 rounded-full blur-[30px]"
          style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.14), transparent 65%)' }}
        />
        <div className="panel relative mx-auto max-w-[460px] !rounded-hero p-7 sm:p-9">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

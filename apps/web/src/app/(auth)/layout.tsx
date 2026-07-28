import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden bg-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="font-display text-2xl">
          Ekklesia
        </Link>
        <div>
          <p className="font-display text-3xl leading-snug">
            &ldquo;The marketplace built for faith communities — discover gatherings,
            invite a friend, and welcome them home.&rdquo;
          </p>
          <p className="mt-6 text-sm text-brand-100">
            For churches, ministries, and communities across the UK, EU, and US.
          </p>
        </div>
      </aside>
      <main className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

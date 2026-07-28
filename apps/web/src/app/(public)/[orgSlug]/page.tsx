import { notFound } from 'next/navigation';
import { api } from '@/lib/api';

interface Org {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
}

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await api<Org | null>(`/v1/organizations/${orgSlug}`).catch(() => null);
  if (!org) return { title: 'Not found' };
  return { title: org.name, description: org.shortDescription ?? undefined };
}

export default async function OrgPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await api<Org | null>(`/v1/organizations/${orgSlug}`).catch(() => null);
  if (!org) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center gap-6">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-ink-100">
          {org.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="font-display text-4xl text-ink-900">{org.name}</h1>
          {org.shortDescription && <p className="mt-2 text-ink-500">{org.shortDescription}</p>}
        </div>
      </header>
      {org.description && (
        <p className="mt-8 max-w-2xl text-ink-700">{org.description}</p>
      )}
    </main>
  );
}

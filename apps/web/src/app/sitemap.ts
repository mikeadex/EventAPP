import type { MetadataRoute } from 'next';
import { searchEvents } from '@/lib/api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  const data = await searchEvents({ limit: 50 }).catch(() => null);
  const events = data?.items ?? [];
  const hosts = [...new Set(events.map((e) => e.organization.slug))];
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/events`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/for-churches`, changeFrequency: 'monthly', priority: 0.6 },
    ...hosts.map((h) => ({ url: `${base}/${h}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...events.map((e) => ({
      url: `${base}/${e.organization.slug}/${e.slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}

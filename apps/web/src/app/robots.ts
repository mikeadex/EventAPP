import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/sign-in', '/sign-up', '/reset-password', '/account', '/me/', '/saved', '/organizer', '/admin', '/claim/', '/takedown/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ekklesia', template: '%s · Ekklesia' },
  description: 'Discover church events near you. Find services, gatherings, conferences and more.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  openGraph: {
    siteName: 'Ekklesia',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

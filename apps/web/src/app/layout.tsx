import type { Metadata, Viewport } from 'next';
import './globals.css';
import { MarkDefs } from '@/components/brand';

export const metadata: Metadata = {
  title: {
    default: 'Ekklesia Events — church and faith-community events',
    template: '%s · Ekklesia Events',
  },
  description:
    'Discover worship nights, conferences, courses and outreach near you. RSVP in seconds and keep every ticket in one place.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  openGraph: {
    siteName: 'Ekklesia Events',
    type: 'website',
    locale: 'en_GB',
  },
  appleWebApp: { title: 'Ekklesia' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0d0a0b' },
    { media: '(prefers-color-scheme: light)', color: '#fffaf9' },
  ],
};

// Runs before paint: saved choice → system preference → dark (the default).
const themeScript = `(function(){try{var t=localStorage.getItem('ek-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-ink">
        <MarkDefs />
        {children}
      </body>
    </html>
  );
}

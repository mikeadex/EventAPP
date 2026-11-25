import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MarkDefs } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://ekklesiaevents.com"),
  title: {
    default: "Ekklesia Events — church and faith-community events",
    template: "%s · Ekklesia Events",
  },
  description:
    "Discover worship nights, conferences, courses and outreach near you. RSVP or buy tickets in seconds, and help your church fill every room.",
  openGraph: {
    type: "website",
    siteName: "Ekklesia Events",
    locale: "en_GB",
  },
  appleWebApp: { title: "Ekklesia" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0a0b" },
    { media: "(prefers-color-scheme: light)", color: "#fffaf9" },
  ],
};

// Runs before paint: saved choice → system preference → dark (the app's default).
const themeScript = `(function(){try{var t=localStorage.getItem('ek-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-ink">
        <MarkDefs />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

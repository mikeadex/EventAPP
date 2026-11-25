import type { MetadataRoute } from "next";
import { events, hosts } from "@/lib/data";

const base = "https://ekklesiaevents.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...["", "/events", "/hosts", "/for-hosts"].map((p) => ({ url: `${base}${p}` })),
    ...events.map((e) => ({ url: `${base}/events/${e.slug}` })),
    ...hosts.map((h) => ({ url: `${base}/hosts/${h.slug}` })),
  ];
}

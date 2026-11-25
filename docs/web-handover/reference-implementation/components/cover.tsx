import Image from "next/image";
import type { Category } from "@/lib/data";

// Generated cover art for events without a photo — tonal, on-brand, and
// clearly a placeholder for the host's own image.
const palettes: Record<Category, [string, string, string]> = {
  Worship: ["#3a1712", "#7e1d14", "#f98e80"],
  Conference: ["#1f1418", "#4a2a2e", "#d9564a"],
  Class: ["#21161a", "#5e2a24", "#ffc9c2"],
  Outreach: ["#2a1410", "#9a3a2c", "#f98e80"],
  Fundraiser: ["#2b0f0c", "#7e1d14", "#ffb4a8"],
  Youth: ["#2a1016", "#c4392c", "#ffc9c2"],
  Prayer: ["#160f12", "#3b2226", "#f98e80"],
  Concert: ["#1d1013", "#5c1d17", "#ffd9d2"],
};

export function Cover({
  image,
  category,
  title,
  priority = false,
  sizes = "(min-width: 1024px) 33vw, 100vw",
}: {
  image?: string;
  category: Category;
  title: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (image) {
    return <Image src={image} alt="" fill priority={priority} sizes={sizes} className="object-cover" />;
  }
  const [a, b, c] = palettes[category];
  // deterministic variation so neighbouring cards don't look identical
  const h = [...title].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const cx = 60 + (h % 280);
  const cy = 20 + ((h >> 4) % 180);
  const flip = (h >> 8) % 2 === 0;
  const mx = flip ? 220 + ((h >> 3) % 60) : 10 + ((h >> 5) % 60);
  const my = 40 + ((h >> 6) % 70);
  const ox = Math.round((cx / 400) * 100);
  const oy = Math.round((cy / 240) * 100);
  return (
    <div
      aria-hidden="true"
      className="cover-art absolute inset-0 overflow-hidden"
      style={{ background: `radial-gradient(120% 90% at ${ox}% ${oy}%, ${b} 0%, ${a} 55%, #0d0a0b 100%)` }}
    >
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke={c} strokeOpacity="0.16">
          {[40, 80, 120, 160, 200, 240].map((r) => (
            <circle key={r} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        <g stroke={c} strokeOpacity="0.22" strokeLinecap="round" fill="none" transform={`translate(${mx} ${my}) scale(1.6)`}>
          <path d="M18 50 H70" strokeWidth="14" />
          <path d="M70 50 A26 26 0 1 0 58 71" strokeWidth="14" />
          <path d="M76 62 V88" strokeWidth="8" />
          <path d="M76 79 L88 68" strokeWidth="8" />
          <path d="M76 79 L90 88" strokeWidth="8" />
        </g>
      </svg>
      <span className="sr-only">{title}</span>
    </div>
  );
}

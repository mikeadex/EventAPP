import { categoryOf } from '@/lib/categories';

/**
 * An event's cover: the host's photo, or generated tonal cover art when there
 * is none (never a broken image). Fills its positioned parent.
 */
export function Cover({
  image,
  category,
  title,
  className = '',
}: {
  image?: string | null;
  category: string;
  title: string;
  className?: string;
}) {
  if (image) {
    return (
      // Hosts upload to object storage on arbitrary domains, so a plain <img>
      // rather than next/image (which needs every host allow-listed).
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className={`absolute inset-0 h-full w-full object-cover ${className}`} />
    );
  }
  const [a, b, c] = categoryOf(category).palette;
  // Deterministic variation so neighbouring cards don't look identical.
  const h = [...title].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const cx = 60 + (h % 280);
  const cy = 20 + ((h >> 4) % 180);
  const mx = (h >> 8) % 2 === 0 ? 220 + ((h >> 3) % 60) : 10 + ((h >> 5) % 60);
  const my = 40 + ((h >> 6) % 70);
  return (
    <div
      aria-hidden="true"
      className={`cover-art absolute inset-0 overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at ${Math.round(cx / 4)}% ${Math.round(cy / 2.4)}%, ${b} 0%, ${a} 55%, #0d0a0b 100%)`,
      }}
    >
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <g fill="none" stroke={c} strokeOpacity="0.16">
          {[40, 80, 120, 160, 200].map((r) => (
            <circle key={r} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        <g
          stroke={c}
          strokeOpacity="0.22"
          strokeLinecap="round"
          fill="none"
          transform={`translate(${mx} ${my}) scale(1.6)`}
        >
          <path d="M18 50 H70" strokeWidth="14" />
          <path d="M70 50 A26 26 0 1 0 58 71" strokeWidth="14" />
          <path d="M76 62 V88" strokeWidth="8" />
          <path d="M76 79 L88 68" strokeWidth="8" />
          <path d="M76 79 L90 88" strokeWidth="8" />
        </g>
      </svg>
    </div>
  );
}

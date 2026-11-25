import Link from "next/link";

/** Shared gradient for every mark on the page. Stops follow the theme (coral on dark, deep coral on light). */
export function MarkDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ek-mark" x1="18" y1="24" x2="92" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--mark-a)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--mark-b)" }} />
          <stop offset="1" style={{ stopColor: "var(--mark-c)" }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The "ek" mark — the k drops into the opening of the e. Geometry from the brand sheet. */
export function Mark({ size = 32, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={(size * 78) / 85}
      viewBox="11.5 16.6 85 78"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g stroke="url(#ek-mark)" strokeLinecap="round" fill="none">
        <path d="M18 50 H70" strokeWidth="14" />
        <path d="M70 50 A26 26 0 1 0 58 71" strokeWidth="14" />
        <path d="M76 62 V88" strokeWidth="8" />
        <path d="M76 79 L88 68" strokeWidth="8" />
        <path d="M76 79 L90 88" strokeWidth="8" />
      </g>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label="Ekklesia Events — home">
      <Mark size={34} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[22px] tracking-[-0.01em] text-strong">ekklesia</span>
          <span className="mt-1 pl-[2px] text-[9px] tracking-[0.52em] text-accent">EVENTS</span>
        </span>
      )}
    </Link>
  );
}

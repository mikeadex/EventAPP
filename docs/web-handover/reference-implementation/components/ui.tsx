import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "md" | "lg" | "sm";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-full whitespace-nowrap transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // The app's primary action: tinted fill + 1px accent line, never a flat flood
  primary: "bg-accent-soft border border-line-3 text-accent-ink hover:bg-[rgb(var(--accent-rgb)/0.2)] hover:border-accent",
  outline: "border border-line-2 text-ink hover:border-line-3 hover:text-accent",
  ghost: "text-ink-2 hover:text-accent",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-[16px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`eyebrow text-accent ${className}`}>{children}</span>;
}

/** Outlined pill tag, as on the Discover hero */
export function Tag({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
  return solid ? (
    <span className="eyebrow inline-flex w-fit rounded-full bg-badge px-2.5 py-1 text-[10px] text-badge-ink">{children}</span>
  ) : (
    <span className="eyebrow inline-flex w-fit rounded-full border border-line-3 px-3 py-1 text-[10px] text-accent">{children}</span>
  );
}

export function Dot() {
  return <span aria-hidden="true" className="inline-block size-[3px] rounded-full bg-accent" />;
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  intro,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  intro?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="text-[30px] leading-[1.1] text-strong md:text-[40px]">{title}</h2>
        {intro && <p className="text-[16px] leading-relaxed text-body text-pretty">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

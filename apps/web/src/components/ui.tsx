import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { initials } from '@/lib/format';

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`eyebrow text-accent ${className}`}>{children}</span>;
}

export function PageIntro({
  eyebrow,
  title,
  intro,
  action,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="h1">{title}</h1>
        {intro && <p className="max-w-[560px] text-[16px] leading-relaxed text-body">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  intro,
  id,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  intro?: string;
  id?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={id} className="h2">
          {title}
        </h2>
        {intro && <p className="text-[16px] leading-relaxed text-body">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  className = '',
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center justify-center overflow-hidden rounded-full border border-line-3 bg-avatar text-accent ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Empty state card: icon, title, one line, one action. */
export function EmptyState({
  icon = 'search',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-20 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-line-2 text-accent">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-[22px] text-strong">{title}</h2>
      {body && <p className="max-w-[380px] text-[15px] leading-relaxed text-body">{body}</p>}
      {action}
    </div>
  );
}

/** Inline error card with an optional retry. */
export function ErrorCard({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 p-6">
      <span className="flex items-center gap-2 text-accent">
        <Icon name="alert" /> Something went wrong
      </span>
      <p className="text-[15px] text-body">{message}</p>
      {action}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href as never}
      className="mb-8 inline-flex items-center gap-2 text-[14px] text-ink-2 transition-colors hover:text-accent"
    >
      <Icon name="arrowLeft" size={16} /> {children}
    </Link>
  );
}

/** A labelled key/value row for summary cards. */
export function Row({ k, v, mono = false }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[15px]">
      <span className="text-ink-2">{k}</span>
      <span className={`text-right ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

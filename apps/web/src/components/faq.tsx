import type { ReactNode } from 'react';

/**
 * FAQ accordion. Native <details>/<summary>: keyboard operable and announced
 * as expandable by screen readers with no script at all.
 */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((f, i) => (
        <details key={f.q} className="group" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[18px] text-strong [&::-webkit-details-marker]:hidden">
            {f.q}
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-line-2 text-accent transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="max-w-[640px] pb-6 text-[15px] leading-relaxed text-body">{f.a}</div>
          <div className="rule-x" />
        </details>
      ))}
    </div>
  );
}

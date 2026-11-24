import type { ReactNode } from 'react';

/**
 * FAQ accordion. Native <details>/<summary>: keyboard operable and announced
 * as expandable by screen readers with no script at all. All closed to start,
 * with a plain +/− sign, as in the design.
 */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="flex flex-col">
      {items.map((f) => (
        <details key={f.q} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] text-strong [&::-webkit-details-marker]:hidden">
            {f.q}
            <span aria-hidden="true" className="flex-none text-[22px] leading-none text-accent">
              <span className="group-open:hidden">+</span>
              <span className="hidden group-open:inline">−</span>
            </span>
          </summary>
          <div className="max-w-[640px] pb-5 text-[15px] leading-[1.65] text-body">{f.a}</div>
        </details>
      ))}
    </div>
  );
}

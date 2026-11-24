'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  /** Search param the selected tab is written to, e.g. `status` → `?status=review`. */
  param: string;
  /** Accessible name for the tab row. */
  label?: string;
}

/**
 * Underline tabs whose selection lives in the URL, so a filtered view can be
 * shared. The first item is the default and is selected when the param is
 * absent or unknown.
 */
export function Tabs(props: TabsProps) {
  // useSearchParams needs a Suspense boundary on statically rendered pages.
  return (
    <Suspense fallback={<TabRow {...props} current={props.items[0]?.key} hrefFor={() => '#'} />}>
      <UrlTabs {...props} />
    </Suspense>
  );
}

function UrlTabs(props: TabsProps) {
  const pathname = usePathname();
  const search = useSearchParams();
  const value = search.get(props.param);
  const current = props.items.some((i) => i.key === value) ? value! : props.items[0]?.key;

  function hrefFor(key: string) {
    const next = new URLSearchParams(search.toString());
    if (key === props.items[0]?.key) next.delete(props.param);
    else next.set(props.param, key);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return <TabRow {...props} current={current} hrefFor={hrefFor} />;
}

function TabRow({
  items,
  label,
  current,
  hrefFor,
}: TabsProps & { current: string | undefined; hrefFor: (key: string) => string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => {
        const on = t.key === current;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key) as never}
            scroll={false}
            className={on ? 'tab on' : 'tab'}
            aria-current={on ? 'page' : undefined}
          >
            {t.label}
            {t.count !== undefined ? <span className="n">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

/**
 * URL-backed filters for an admin list: `setParam` writes one query param,
 * and the search box (`draft`/`setDraft`) is written to `?q=` once typing
 * pauses. The box follows the URL when it changes from outside
 * (back/forward) without trimming what is being typed.
 */
export function useUrlSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const q = search.get('q') ?? '';
  const [draft, setDraft] = useState(q);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(search.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace((qs ? `${pathname}?${qs}` : pathname) as never, { scroll: false });
    },
    [pathname, router, search],
  );

  useEffect(() => setDraft((d) => (d.trim() === q ? d : q)), [q]);

  useEffect(() => {
    if (draft.trim() === q) return;
    const t = setTimeout(() => setParam('q', draft.trim() || null), 300);
    return () => clearTimeout(t);
  }, [draft, q, setParam]);

  return { search, q, draft, setDraft, setParam };
}

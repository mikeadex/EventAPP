'use client';

import { useEffect, useRef } from 'react';

/**
 * On phones, side navs become a sideways-scrolling row of chips, and the
 * current one can sit off-screen ("Sign-in & secu…"). This scrolls the row —
 * only the row, never the page — so the `aria-current` item is visible.
 */
export function useActiveInView<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const row = ref.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    const left = active.offsetLeft - row.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = left - 16;
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth + 16;
  }, [key]);
  return ref;
}

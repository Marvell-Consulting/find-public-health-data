import type { ReactNode } from 'react';

/**
 * A wide table's sideways scroll, reachable from the keyboard: the wrapper is a labelled,
 * focusable region, the pattern ChartSection uses, so the arrow keys can move it.
 */
export function TableScrollRegion({ children, label }: { children: ReactNode; label: string }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region needs focus to scroll by keyboard.
    <section aria-label={label} className="fphd-table-scroll-wrapper" tabIndex={0}>
      {children}
    </section>
  );
}

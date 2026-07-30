import { type ReactNode, useId } from 'react';

interface ChartSectionProps {
  children?: ReactNode;
  description: string;
  id: string;
  title: string;
}

/**
 * A chart's place on the page before the chart itself exists (ADR013). The region is
 * labelled and keyboard-reachable from the outset — the focusable scrollable-region
 * pattern a real chart needs — so a chart ticket replaces the contents without having to
 * rebuild the page's accessibility structure.
 */
export function ChartSection({ children, description, id, title }: ChartSectionProps) {
  const headingId = useId();

  return (
    <div className="fphd-chart-section" id={id}>
      <h3 className="govuk-heading-m" id={headingId}>
        {title}
      </h3>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: see the note above — the region is deliberately focusable. */}
      <section className="fphd-chart-placeholder" aria-labelledby={headingId} tabIndex={0}>
        <p className="govuk-body">{description}</p>
        <p className="govuk-hint">Data visualisation to follow</p>
        {children}
      </section>
    </div>
  );
}

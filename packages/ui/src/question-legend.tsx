import type { ReactNode } from 'react';

interface QuestionLegendProps {
  children: ReactNode;
  /** A question asked inside another's answer is an h3, or no heading at all. */
  as?: 'h2' | 'h3' | 'span';
  size?: 'm' | 's';
}

/** A question's text as the label of a NotGovUK fieldset, sized as GOV.UK sizes a legend. */
// NotGovUK sizes a legend by the heading in it; upstream: daniel-ac-martin/NotGovUK#2057 (FPH-445).
export function QuestionLegend({ as: Heading = 'h2', children, size = 'm' }: QuestionLegendProps) {
  return <Heading className={`govuk-heading-${size}`}>{children}</Heading>;
}

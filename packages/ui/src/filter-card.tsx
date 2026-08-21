import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * The sidebar card the prototype uses for each filter dimension: a grey header carrying
 * the title and a Clear all link, a body listing what is selected, and a footer holding
 * the control that adds more.
 */
export function FilterCard({
  body,
  footer,
  onClear,
  title,
}: {
  body: ReactNode;
  footer?: ReactNode | undefined;
  onClear?: string | undefined;
  title: string;
}) {
  return (
    <div className="fphd-filter-card govuk-!-margin-bottom-4">
      <div className="fphd-filter-card__header">
        <h2 className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-0">{title}</h2>
        {onClear ? (
          <Link className="govuk-link govuk-body-s" to={onClear}>
            Clear all
          </Link>
        ) : null}
      </div>
      <div className="fphd-filter-card__body">{body}</div>
      {footer ? <div className="fphd-filter-card__footer">{footer}</div> : null}
    </div>
  );
}

/**
 * A selected value. Without `onRemove` the chip is fixed — the prototype shows the default
 * area this way, since removing it would leave nothing to compare against.
 */
export function FilterChip({
  children,
  onRemove,
  removeLabel,
  value,
}: {
  children: ReactNode;
  onRemove?: string | undefined;
  removeLabel?: string | undefined;
  value: string;
}) {
  return (
    <div className="fphd-filter-chip" data-value={value}>
      {onRemove ? (
        <Link
          aria-label={`Remove ${removeLabel} filter`}
          className="fphd-filter-chip__remove govuk-link"
          to={onRemove}
        >
          ×
        </Link>
      ) : null}
      <span>{children}</span>
    </div>
  );
}

export function FilterChips({ children }: { children: ReactNode }) {
  return (
    <div className="fphd-filter-chips fphd-filter-chips--inline govuk-!-margin-bottom-2">
      {children}
    </div>
  );
}

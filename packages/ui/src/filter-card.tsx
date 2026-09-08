import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

/**
 * Sidebar card for a filter dimension: a grey header carrying the title and a Clear all
 * link, a body listing what is selected, and a footer holding the control that adds more.
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
          // A router Link, so clearing is a push-state navigation with the plain
          // anchor as the no-script fallback.
          <Link
            className="govuk-link govuk-body-s govuk-!-margin-bottom-0"
            preventScrollReset
            to={onClear}
          >
            Clear all
          </Link>
        ) : null}
      </div>
      <div className="fphd-filter-card__body">{body}</div>
      {footer ? <div className="fphd-filter-card__footer">{footer}</div> : null}
    </div>
  );
}

export function CollapsibleFilterCard({
  children,
  footer,
  hint,
  active,
  onClear,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode | undefined;
  hint?: string | undefined;
  active: boolean;
  onClear?: string | undefined;
  title: string;
}) {
  const bodyId = useId();
  const [open, setOpen] = useState(active);
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="fphd-filter-card govuk-!-margin-bottom-4">
      <div className="fphd-filter-card__header">
        <span className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-0">{title}</span>
        <button
          aria-controls={bodyId}
          aria-expanded={open}
          className="govuk-body-s fphd-link-button"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {/* Body is always in the HTML so no-JS users can reach all filters.
          CSS shows it when js-enabled is absent; JS toggles the hidden attribute. */}
      <div className="fphd-filter-card__body fphd-collapsible-body" hidden={!open} id={bodyId}>
        {onClear ? (
          <Link
            className="govuk-link govuk-body-s govuk-!-display-block govuk-!-margin-bottom-4"
            preventScrollReset
            to={onClear}
          >
            Clear filter
          </Link>
        ) : null}
        {hint ? <p className="govuk-hint govuk-!-margin-bottom-3">{hint}</p> : null}
        {children}
      </div>
      {footer ? (
        <div className="fphd-filter-card__footer fphd-collapsible-body" hidden={!open}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A selected value. Without `onRemove` the chip is fixed — the default area cannot be
 * removed since that would leave nothing to compare against.
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
          preventScrollReset
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

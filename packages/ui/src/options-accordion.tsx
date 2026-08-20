import { type ReactNode, useId, useState } from 'react';

/** The prototype's single-section GOV.UK accordion around a panel's option controls. */
export function OptionsAccordion({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const contentId = useId();

  return (
    <div className="govuk-accordion fphd-options-accordion" data-module="">
      <div
        className={`govuk-accordion__section${open ? ' govuk-accordion__section--expanded' : ''}`}
      >
        <div className="govuk-accordion__section-header">
          <h2 className="govuk-accordion__section-heading">
            <button
              type="button"
              aria-controls={contentId}
              aria-expanded={open}
              className="govuk-accordion__section-button"
              onClick={() => setOpen((current) => !current)}
            >
              <span className="govuk-accordion__section-heading-text">
                <span className="govuk-accordion__section-heading-text-focus">{label}</span>
              </span>
              <span className="govuk-visually-hidden govuk-accordion__section-heading-divider">
                ,{' '}
              </span>
              <span className="govuk-accordion__section-toggle">
                <span className="govuk-accordion__section-toggle-focus">
                  <span className="govuk-accordion-nav__chevron" />
                  <span className="govuk-accordion__section-toggle-text">
                    {open ? 'Hide' : 'Show'}
                  </span>
                </span>
              </span>
            </button>
          </h2>
        </div>
        {open ? (
          <div className="govuk-accordion__section-content" id={contentId}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

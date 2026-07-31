import { type ReactNode, useId, useState } from 'react';

/**
 * A single-section GOV.UK Accordion, which is how the design presents each panel's
 * options. Written in React rather than by loading govuk-frontend's JavaScript, with the
 * same markup and ARIA wiring; without scripting the section renders open, so its
 * controls are always reachable.
 */
export function OptionsAccordion({ children, title }: { children: ReactNode; title: string }) {
  const id = useId();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="govuk-accordion" data-module="govuk-accordion" id={id}>
      <div className="govuk-accordion__section govuk-accordion__section--expanded">
        <div className="govuk-accordion__section-header">
          <h2 className="govuk-accordion__section-heading">
            <button
              aria-controls={`${id}-content`}
              aria-expanded={expanded}
              aria-label={`${title} , ${expanded ? 'Hide' : 'Show'} this section`}
              className="govuk-accordion__section-button"
              onClick={() => setExpanded((open) => !open)}
              type="button"
            >
              <span className="govuk-accordion__section-heading-text" id={`${id}-heading`}>
                <span className="govuk-accordion__section-heading-text-focus">{title}</span>
              </span>
              <span className="govuk-visually-hidden govuk-accordion__section-heading-divider">
                ,{' '}
              </span>
              <span className="govuk-accordion__section-toggle" data-nosnippet="">
                <span className="govuk-accordion__section-toggle-focus">
                  <span className="govuk-accordion-nav__chevron" />
                  <span className="govuk-accordion__section-toggle-text">
                    {expanded ? 'Hide' : 'Show'}
                    <span className="govuk-visually-hidden"> this section</span>
                  </span>
                </span>
              </span>
            </button>
          </h2>
        </div>
        <div
          aria-labelledby={`${id}-heading`}
          className={`govuk-accordion__section-content${expanded ? '' : ' govuk-accordion__section-content--hidden'}`}
          id={`${id}-content`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

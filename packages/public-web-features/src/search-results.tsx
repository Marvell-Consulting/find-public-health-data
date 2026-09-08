import { Button, InsetText } from '@fphd/ui';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import type { IndicatorSearchResult } from './search-loader.js';

const MAX_SELECTED = 10;
const SEARCH_CAP = 200;

interface SearchResultsProps {
  searchResult: IndicatorSearchResult;
  gaCodes: string[];
}

export function SearchResults({ searchResult, gaCodes }: SearchResultsProps) {
  const [ticked, setTicked] = useState<number[]>([]);
  const { total, indicators } = searchResult;
  const capped = total > SEARCH_CAP;

  const toggle = (id: number, checked: boolean) => {
    setTicked((prev) => {
      if (checked && prev.length >= MAX_SELECTED) return prev;
      return checked ? [...prev, id] : prev.filter((v) => v !== id);
    });
  };

  const headingText =
    ticked.length > 0
      ? `${ticked.length.toLocaleString()} of ${total.toLocaleString()} indicators selected`
      : `Select from ${total.toLocaleString()} indicators`;

  return (
    <>
      <div className="fphd-results-sort govuk-!-margin-top-4 govuk-!-margin-bottom-3">
        <h2
          aria-live="polite"
          className="govuk-heading-m govuk-!-margin-bottom-0"
          id="results-heading"
        >
          {headingText}
        </h2>
      </div>

      {indicators.length === 0 ? (
        <InsetText>No indicators match your selected filters or search terms.</InsetText>
      ) : (
        <Form action="/indicators" method="get">
          {gaCodes.map((code) => (
            <input key={code} name="as" type="hidden" value={code} />
          ))}

          <div className="govuk-!-margin-bottom-2">
            <Button className="govuk-!-margin-bottom-0 fphd-view-selected" type="submit">
              View selected indicators
            </Button>
          </div>

          {ticked.length >= MAX_SELECTED ? (
            <p className="govuk-body govuk-!-margin-bottom-2">
              You can select up to 10 indicators.
            </p>
          ) : null}

          <ul className="govuk-list fphd-search-results">
            {indicators.map((indicator) => {
              const isSelected = ticked.includes(indicator.fingertipsId);
              const isDisabled = !isSelected && ticked.length >= MAX_SELECTED;
              const topicChips = indicator.topics;
              const itChips = indicator.classifications.filter(
                (c) => c.dimension === 'indicator_type',
              );
              const rfChips = indicator.classifications.filter(
                (c) => c.dimension === 'risk_factor',
              );

              const hasMeta = topicChips.length > 0 || itChips.length > 0 || rfChips.length > 0;

              return (
                <li className="fphd-indicator-item" key={indicator.fingertipsId}>
                  <div className="govuk-checkboxes">
                    <div className="govuk-checkboxes__item">
                      <input
                        checked={isSelected}
                        className="govuk-checkboxes__input"
                        disabled={isDisabled}
                        id={`is-${indicator.fingertipsId}`}
                        name="is"
                        onChange={(e) => toggle(indicator.fingertipsId, e.target.checked)}
                        type="checkbox"
                        value={indicator.fingertipsId}
                      />
                      <label
                        className="govuk-label govuk-checkboxes__label"
                        htmlFor={`is-${indicator.fingertipsId}`}
                      >
                        <span className="govuk-visually-hidden">{indicator.name}</span>
                        <strong>
                          <Link className="govuk-link" to={`/indicators/${indicator.fingertipsId}`}>
                            {indicator.name}
                          </Link>
                        </strong>
                        {hasMeta ? (
                          <dl className="govuk-summary-list govuk-!-margin-bottom-0 govuk-!-margin-top-1">
                            {topicChips.length > 0 ? (
                              <div className="govuk-summary-list__row">
                                <dt className="govuk-summary-list__key">Topics</dt>
                                <dd className="govuk-summary-list__value">
                                  <div
                                    className="fphd-filter-chips fphd-filter-chips--inline"
                                    style={{ gap: '4px', marginTop: '2px' }}
                                  >
                                    {topicChips.map((t) => (
                                      <div
                                        className="fphd-filter-chip fphd-filter-chip--tag"
                                        key={t.slug}
                                      >
                                        {t.title}
                                      </div>
                                    ))}
                                  </div>
                                </dd>
                              </div>
                            ) : null}
                            {itChips.length > 0 ? (
                              <div className="govuk-summary-list__row">
                                <dt className="govuk-summary-list__key">Indicator types</dt>
                                <dd className="govuk-summary-list__value">
                                  <div
                                    className="fphd-filter-chips fphd-filter-chips--inline"
                                    style={{ gap: '4px', marginTop: '2px' }}
                                  >
                                    {itChips.map((c) => (
                                      <div
                                        className="fphd-filter-chip fphd-filter-chip--tag"
                                        key={c.slug}
                                      >
                                        {c.name}
                                      </div>
                                    ))}
                                  </div>
                                </dd>
                              </div>
                            ) : null}
                            {rfChips.length > 0 ? (
                              <div className="govuk-summary-list__row">
                                <dt className="govuk-summary-list__key">Risk factors</dt>
                                <dd className="govuk-summary-list__value">
                                  <div
                                    className="fphd-filter-chips fphd-filter-chips--inline"
                                    style={{ gap: '4px', marginTop: '2px' }}
                                  >
                                    {rfChips.map((c) => (
                                      <div
                                        className="fphd-filter-chip fphd-filter-chip--tag"
                                        key={c.slug}
                                      >
                                        {c.name}
                                      </div>
                                    ))}
                                  </div>
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        ) : null}
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {capped ? (
            <p className="govuk-body govuk-!-margin-top-3">
              Showing the first {SEARCH_CAP.toLocaleString()} of {total.toLocaleString()}. Add a
              filter to narrow the list.
            </p>
          ) : null}
        </Form>
      )}
    </>
  );
}

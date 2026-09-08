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
      <h2 aria-live="polite" className="govuk-heading-m" id="results-heading">
        {headingText}
      </h2>

      {indicators.length === 0 ? (
        <InsetText>No indicators match your selected filters or search terms.</InsetText>
      ) : (
        <Form action="/indicators" method="get">
          {gaCodes.map((code) => (
            <input key={code} name="as" type="hidden" value={code} />
          ))}

          <Button className="govuk-!-margin-bottom-4" type="submit">
            View selected indicators
          </Button>

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

              return (
                <li className="fphd-indicator-item" key={indicator.fingertipsId}>
                  <div className="govuk-checkboxes govuk-checkboxes--small">
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
                        <Link className="govuk-link" to={`/indicators/${indicator.fingertipsId}`}>
                          {indicator.name}
                        </Link>
                      </label>
                    </div>
                  </div>

                  {topicChips.length > 0 || itChips.length > 0 || rfChips.length > 0 ? (
                    <dl className="govuk-summary-list govuk-summary-list--no-border govuk-!-margin-bottom-0 govuk-!-margin-top-1">
                      {topicChips.length > 0 ? (
                        <div className="govuk-summary-list__row">
                          <dt className="govuk-summary-list__key">Topics</dt>
                          <dd className="govuk-summary-list__value">
                            <ul className="govuk-list fphd-tag-list">
                              {topicChips.map((t) => (
                                <li key={t.slug}>
                                  <Link className="fphd-tag" to={`/topics/${t.slug}`}>
                                    {t.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      {itChips.length > 0 ? (
                        <div className="govuk-summary-list__row">
                          <dt className="govuk-summary-list__key">Indicator types</dt>
                          <dd className="govuk-summary-list__value">
                            <ul className="govuk-list fphd-tag-list">
                              {itChips.map((c) => (
                                <li key={c.slug}>
                                  <span className="fphd-tag">{c.name}</span>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      {rfChips.length > 0 ? (
                        <div className="govuk-summary-list__row">
                          <dt className="govuk-summary-list__key">Risk factors</dt>
                          <dd className="govuk-summary-list__value">
                            <ul className="govuk-list fphd-tag-list">
                              {rfChips.map((c) => (
                                <li key={c.slug}>
                                  <span className="fphd-tag">{c.name}</span>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
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

import { Button, Checkboxes, InsetText, SummaryList } from '@fphd/ui';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import { MAX_SELECTED_INDICATORS } from './indicator-loader.js';
import type { IndicatorSearchResult, IndicatorSearchRow } from './search-loader.js';

interface SearchResultsProps {
  searchResult: IndicatorSearchResult;
  gaCodes: string[];
}

function Tags({ items }: { items: { key: string; label: string }[] }) {
  return (
    <div className="fphd-filter-chips fphd-filter-chips--inline">
      {items.map((item) => (
        <div className="fphd-filter-chip fphd-filter-chip--tag" key={item.key}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

function ResultMeta({ indicator }: { indicator: IndicatorSearchRow }) {
  const classified = (dimension: string) =>
    indicator.classifications
      .filter((c) => c.dimension === dimension)
      .map((c) => ({ key: c.slug, label: c.name }));
  const rows = [
    { key: 'Topics', items: indicator.topics.map((t) => ({ key: t.slug, label: t.title })) },
    { key: 'Indicator types', items: classified('indicator_type') },
    { key: 'Risk factors', items: classified('risk_factor') },
  ].filter((row) => row.items.length > 0);

  if (rows.length === 0) return null;

  return (
    <SummaryList
      className="govuk-!-margin-bottom-0 govuk-!-margin-top-1"
      items={rows.map((row) => ({
        children: <Tags items={row.items} />,
        name: row.key,
      }))}
    />
  );
}

export function SearchResults({ searchResult, gaCodes }: SearchResultsProps) {
  const [ticked, setTicked] = useState<number[]>([]);
  const { total, limit, indicators } = searchResult;
  const capped = total > limit;

  const toggle = (id: number, checked: boolean) => {
    setTicked((prev) => {
      if (checked && prev.length >= MAX_SELECTED_INDICATORS) return prev;
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

          {ticked.length >= MAX_SELECTED_INDICATORS ? (
            <p className="govuk-body govuk-!-margin-bottom-2">
              You can select up to {MAX_SELECTED_INDICATORS} indicators.
            </p>
          ) : null}

          {/* A label holds phrasing content only, so the metadata is a sibling of it and
              the fieldset names the set — hence each group's own label being empty. */}
          <fieldset className="govuk-fieldset fphd-search-results">
            <legend className="govuk-visually-hidden">Indicators</legend>
            {indicators.map((indicator) => {
              const isSelected = ticked.includes(indicator.fingertipsId);
              return (
                <div className="fphd-search-result" key={indicator.fingertipsId}>
                  <Checkboxes
                    checked={isSelected}
                    id={`is-${indicator.fingertipsId}`}
                    label=""
                    name="is"
                    onChange={(event) => toggle(Number(event.target.value), event.target.checked)}
                    options={[
                      {
                        disabled: !isSelected && ticked.length >= MAX_SELECTED_INDICATORS,
                        label: indicator.name,
                        value: String(indicator.fingertipsId),
                      },
                    ]}
                  />
                  <div className="fphd-search-result__body">
                    <Link
                      className="govuk-link govuk-!-display-block govuk-!-font-weight-bold"
                      to={`/indicators/${indicator.fingertipsId}`}
                    >
                      {indicator.name}
                    </Link>
                    <ResultMeta indicator={indicator} />
                  </div>
                </div>
              );
            })}
          </fieldset>

          {capped ? (
            <p className="govuk-body govuk-!-margin-top-3">
              Showing the first {limit.toLocaleString()} of {total.toLocaleString()}. Add a filter
              to narrow the list.
            </p>
          ) : null}
        </Form>
      )}
    </>
  );
}

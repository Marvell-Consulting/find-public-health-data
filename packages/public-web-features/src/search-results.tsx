import { Button, Checkboxes, InsetText } from '@fphd/ui';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import type { IndicatorSearchResult, IndicatorSearchRow } from './search-loader.js';

const MAX_SELECTED = 10;
const SEARCH_CAP = 200;

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

function ResultLabel({ indicator }: { indicator: IndicatorSearchRow }) {
  const classified = (dimension: string) =>
    indicator.classifications
      .filter((c) => c.dimension === dimension)
      .map((c) => ({ key: c.slug, label: c.name }));
  const rows = [
    { key: 'Topics', items: indicator.topics.map((t) => ({ key: t.slug, label: t.title })) },
    { key: 'Indicator types', items: classified('indicator_type') },
    { key: 'Risk factors', items: classified('risk_factor') },
  ].filter((row) => row.items.length > 0);

  return (
    <>
      <span className="govuk-visually-hidden">{indicator.name}</span>
      <strong>
        <Link className="govuk-link" to={`/indicators/${indicator.fingertipsId}`}>
          {indicator.name}
        </Link>
      </strong>
      {rows.length > 0 ? (
        <dl className="govuk-summary-list govuk-!-margin-bottom-0 govuk-!-margin-top-1">
          {rows.map((row) => (
            <div className="govuk-summary-list__row" key={row.key}>
              <dt className="govuk-summary-list__key">{row.key}</dt>
              <dd className="govuk-summary-list__value">
                <Tags items={row.items} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
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

          <Checkboxes
            className="fphd-search-results"
            id="is"
            label={<span className="govuk-visually-hidden">Indicators</span>}
            name="is"
            onChange={(event) => toggle(Number(event.target.value), event.target.checked)}
            options={indicators.map((indicator) => {
              const isSelected = ticked.includes(indicator.fingertipsId);
              return {
                checked: isSelected,
                disabled: !isSelected && ticked.length >= MAX_SELECTED,
                label: <ResultLabel indicator={indicator} />,
                value: String(indicator.fingertipsId),
              };
            })}
          />

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

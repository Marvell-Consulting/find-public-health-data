import { Button, Checkboxes, InsetText, SummaryList, Tag } from '@fphd/ui';
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
    <div className="fphd-tag-list">
      {items.map((item) => (
        <Tag classModifiers="grey" key={item.key}>
          {item.label}
        </Tag>
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
        <SummaryList
          className="govuk-!-margin-bottom-0 govuk-!-margin-top-1"
          items={rows.map((row) => ({
            children: <Tags items={row.items} />,
            name: row.key,
          }))}
        />
      ) : null}
    </>
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
                disabled: !isSelected && ticked.length >= MAX_SELECTED_INDICATORS,
                label: <ResultLabel indicator={indicator} />,
                value: String(indicator.fingertipsId),
              };
            })}
          />

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

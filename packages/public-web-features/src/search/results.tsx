import { Button, Checkboxes, ErrorMessage, InsetText, SummaryList } from '@fphd/ui';
import { useEffect, useState } from 'react';
import { Form, Link } from 'react-router';
import { MAX_SELECTED_INDICATORS } from '../selection-limits.js';
import type { IndicatorSearchResult, IndicatorSearchRow } from './loader.js';

interface SearchResultsProps {
  navigationKey: string;
  searchResult: IndicatorSearchResult;
  gaCodes: string[];
  geoLevels: string[];
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
      .map((c) => ({ key: `${c.dimension}:${c.slug}`, label: c.name }));
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

export function SearchResults({
  navigationKey,
  searchResult,
  gaCodes,
  geoLevels,
}: SearchResultsProps) {
  const [ticked, setTicked] = useState<number[]>([]);
  const [selectionError, setSelectionError] = useState(false);

  // Clear transient choices after a navigation while keeping the live-region element
  // connected, so assistive technology hears the updated result count.
  useEffect(() => {
    setTicked([]);
    setSelectionError(false);
  }, [navigationKey]);

  const { total, limit, indicators } = searchResult;
  const capped = total > limit;
  const geography = new URLSearchParams([
    ...gaCodes.map((code) => ['as', code]),
    ...geoLevels.map((level) => ['als', level]),
  ]).toString();

  const toggle = (id: number, checked: boolean) => {
    setSelectionError(false);
    setTicked((prev) => {
      if (checked && prev.length >= MAX_SELECTED_INDICATORS) return prev;
      return checked ? [...prev, id] : prev.filter((v) => v !== id);
    });
  };

  const headingText =
    ticked.length > 0
      ? `${ticked.length.toLocaleString()} of ${total.toLocaleString()} ${total === 1 ? 'indicator' : 'indicators'} selected`
      : `Select from ${total.toLocaleString()} ${total === 1 ? 'indicator' : 'indicators'}`;

  return (
    <>
      <div className="fphd-results-sort govuk-!-margin-top-4 govuk-!-margin-bottom-3">
        <h2
          aria-atomic="true"
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
        <Form
          action="/indicators"
          method="get"
          onSubmit={(event) => {
            if (ticked.length === 0) {
              event.preventDefault();
              setSelectionError(true);
            }
          }}
        >
          {gaCodes.map((code) => (
            <input key={code} name="as" type="hidden" value={code} />
          ))}
          {geoLevels.map((level) => (
            <input key={level} name="als" type="hidden" value={level} />
          ))}

          <div className="govuk-!-margin-bottom-2">
            <Button className="govuk-!-margin-bottom-0 fphd-view-selected" type="submit">
              View selected indicators
            </Button>
          </div>

          {selectionError ? (
            <ErrorMessage role="alert">Select at least one indicator to view.</ErrorMessage>
          ) : null}

          {ticked.length >= MAX_SELECTED_INDICATORS ? (
            <p className="govuk-body govuk-!-margin-bottom-2">
              You can select up to {MAX_SELECTED_INDICATORS} indicators.
            </p>
          ) : null}

          {/* Metadata sits outside the checkbox label so the label contains phrasing content only. */}
          <fieldset className="fphd-search-results">
            <legend className="govuk-visually-hidden">Indicators</legend>
            {indicators.map((indicator) => {
              const isSelected = ticked.includes(indicator.shortId);
              const option = {
                checked: isSelected,
                disabled: !isSelected && ticked.length >= MAX_SELECTED_INDICATORS,
                label: <span className="govuk-visually-hidden">{indicator.name}</span>,
                value: String(indicator.shortId),
              };
              return (
                <div className="fphd-search-result" key={indicator.shortId}>
                  <Checkboxes
                    id={`is-${indicator.shortId}`}
                    label=""
                    name="is"
                    onChange={(event) => toggle(Number(event.target.value), event.target.checked)}
                    options={[option]}
                  />
                  <div className="fphd-search-result__body">
                    <Link
                      className="govuk-link fphd-search-result__title"
                      to={`/indicators/${indicator.shortId}${geography ? `?${geography}` : ''}`}
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

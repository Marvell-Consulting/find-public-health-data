import { InsetText, SummaryList } from '@fphd/ui';
import { indicatorPath } from '@fphd/utils/indicator-path';
import { Link } from 'react-router';
import type { IndicatorSearchResult, IndicatorSearchRow } from './loader.ts';

interface SearchResultsProps {
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
    { key: 'Measure type', items: classified('indicator_type') },
    { key: 'Life stage', items: classified('life_stage') },
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

export function SearchResults({ searchResult, gaCodes, geoLevels }: SearchResultsProps) {
  const { total, limit, indicators } = searchResult;
  const capped = total > limit;
  const geography = new URLSearchParams([
    ...gaCodes.map((code) => ['as', code]),
    ...geoLevels.map((level) => ['als', level]),
  ]).toString();

  return (
    <>
      <div className="fphd-results-sort govuk-!-margin-top-4 govuk-!-margin-bottom-3">
        <h2
          aria-atomic="true"
          aria-live="polite"
          className="govuk-heading-m govuk-!-margin-bottom-0"
          id="results-heading"
        >
          {total.toLocaleString()} {total === 1 ? 'indicator' : 'indicators'}
        </h2>
      </div>

      {indicators.length === 0 ? (
        <InsetText>No indicators match your selected filters or search terms.</InsetText>
      ) : (
        <>
          <ul className="govuk-list fphd-search-results">
            {indicators.map((indicator) => (
              <li className="fphd-search-result" key={indicator.shortId}>
                <Link
                  className="govuk-link fphd-search-result__title"
                  to={`${indicatorPath(indicator.slug)}${geography ? `?${geography}` : ''}`}
                >
                  {indicator.name}
                </Link>
                <ResultMeta indicator={indicator} />
              </li>
            ))}
          </ul>

          {capped ? (
            <p className="govuk-body govuk-!-margin-top-3">
              Showing the first {limit.toLocaleString()} of {total.toLocaleString()}. Add a filter
              to narrow the list.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

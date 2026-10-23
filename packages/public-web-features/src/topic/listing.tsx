import { InsetText, Select } from '@fphd/ui';
import { Form, Link, useLocation } from 'react-router';
import { ComparisonTable } from '../indicator/tables/comparison-table.tsx';
import { TOPIC_PAGE_SIZE, TOPIC_SORT_OPTIONS } from './data.ts';
import { TopicDownload } from './download.tsx';
import type { loadTopic } from './loader.ts';
import { AreaSummariesTable } from './tables/area-summaries-table.tsx';

type TopicData = { topic: Awaited<ReturnType<typeof loadTopic>>['topic'] } & NonNullable<
  Awaited<ReturnType<typeof loadTopic>>['content']
>;

export function TopicListing({ data, areas = false }: { data: TopicData; areas?: boolean }) {
  const { topic, search, listing } = data;
  const location = useLocation();
  const path = `/topics/${topic.slug}`;
  const tab = areas ? 'areas' : 'data';
  const params = new URLSearchParams(location.search);
  params.set('tab-topic', tab);
  const pageUrl = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `${path}?${next}`;
  };
  const dataSelected =
    data.defaultAreas && !areas
      ? data.data.selected.map((entry) => ({
          ...entry,
          areaData: entry.areaData.filter(({ areaCode }) => areaCode === 'E92000001'),
        }))
      : data.data.selected;
  return (
    <>
      <div className="fphd-results-sort fphd-topic-toolbar govuk-!-margin-bottom-3">
        <h2
          aria-atomic="true"
          aria-live="polite"
          className="govuk-heading-m govuk-!-margin-bottom-0"
        >
          {search.searchResult.total.toLocaleString()}{' '}
          {search.searchResult.total === 1 ? 'indicator' : 'indicators'}
        </h2>
        <Form action={path} method="get" preventScrollReset>
          {[...params]
            .filter(([key]) => key !== 'sort' && key !== 'page')
            .map(([name, value], index) => (
              <input key={`${name}-${index}`} name={name} type="hidden" value={value} />
            ))}
          <Select
            id={`topic-sort-${tab}`}
            label="Sort by"
            name="sort"
            options={TOPIC_SORT_OPTIONS}
            value={listing.sort}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          />
          <noscript>
            <button className="govuk-button govuk-button--secondary" type="submit">
              Sort indicators
            </button>
          </noscript>
        </Form>
        {dataSelected.length > 0 ? <TopicDownload href={`${path}/table.csv?${params}`} /> : null}
      </div>
      {search.searchResult.page === undefined &&
      search.searchResult.total > search.searchResult.limit ? (
        <InsetText>
          Showing the first {search.searchResult.limit} indicators. Add filters to narrow the list.
        </InsetText>
      ) : null}
      {listing.sort.startsWith('trend-') ? (
        <p className="govuk-body-s">
          Trend sorting uses England's headline series. Indicators without a calculated trend appear
          last.
        </p>
      ) : null}
      {dataSelected.length === 0 ? (
        <InsetText>No indicators match your selected filters or search terms.</InsetText>
      ) : areas ? (
        <>
          <p className="govuk-body">
            Latest calculated values for each area, compared with England for the same period and
            population. Comparisons use 95% confidence intervals where available.
          </p>
          {data.defaultAreas ? (
            <p className="govuk-body">
              Showing the first {data.data.selectedAreas.length} local authorities. Use the
              geography filters on the Data tab to choose areas.
            </p>
          ) : null}
          {data.data.areasLimited && !data.defaultAreas ? (
            <InsetText>
              Showing the first {data.data.selectedAreas.length} areas. Select fewer areas to change
              which ones are shown.
            </InsetText>
          ) : null}
          <AreaSummariesTable selected={dataSelected} geography={data.data.benchmarkGeography} />
        </>
      ) : (
        <ComparisonTable
          selected={dataSelected}
          indicatorLinks
          indicatorAnnotations={Object.fromEntries(
            listing.indicators.map(({ shortId }) => [shortId, 'Subtopic to be added']),
          )}
          label={`${topic.title} indicators`}
        />
      )}
      {listing.pages > 1 ? (
        <nav
          aria-label={`${areas ? 'Area summaries' : 'Indicators'} pages`}
          className="fphd-topic-pagination"
        >
          {listing.page > 1 ? (
            <Link className="govuk-link" to={pageUrl(listing.page - 1)}>
              Previous page
            </Link>
          ) : null}
          <p className="govuk-body govuk-!-margin-bottom-0">
            Page {listing.page} of {listing.pages}. Showing{' '}
            {(listing.page - 1) * TOPIC_PAGE_SIZE + 1} to{' '}
            {Math.min(listing.page * TOPIC_PAGE_SIZE, search.searchResult.total)}.
          </p>
          {listing.page < listing.pages ? (
            <Link className="govuk-link" to={pageUrl(listing.page + 1)}>
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

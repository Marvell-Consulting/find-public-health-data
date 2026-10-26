import { FilterChip, FilterChips, InsetText, Select } from '@fphd/ui';
import { Form, useLocation } from 'react-router';
import { DownloadShareData } from '../download-share.tsx';
import { TOPIC_SORT_OPTIONS, topicColumns } from './data.ts';
import type { loadTopic } from './loader.ts';
import { AreaSummariesTable } from './tables/area-summaries-table.tsx';
import { TopicDataTable } from './tables/data-table.tsx';

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
  const dataSelected =
    data.defaultAreas && !areas
      ? data.data.selected.map((entry) => ({
          ...entry,
          areaData: entry.areaData.filter(({ areaCode }) => areaCode === 'E92000001'),
        }))
      : data.data.selected;
  return (
    <>
      <div className="fphd-indicator-showing">
        <p className="govuk-body-s govuk-!-margin-bottom-1">Showing:</p>
        <FilterChips>
          <FilterChip value="E92000001">England</FilterChip>
          {search.geoLevels.map((level) => (
            <FilterChip key={level} value={level}>
              {areas ? `All ${level === 'NHS regions' ? level : level.toLowerCase()}` : level}
            </FilterChip>
          ))}
          {search.gaCodes.map((code) => (
            <FilterChip key={code} value={code}>
              {search.gaAreaNames[code] ?? code}
            </FilterChip>
          ))}
        </FilterChips>
      </div>
      <div className="fphd-results-sort fphd-topic-toolbar govuk-!-margin-bottom-3">
        <h2
          aria-atomic="true"
          aria-live="polite"
          className="govuk-heading-m govuk-!-margin-bottom-0"
        >
          {search.searchResult.total.toLocaleString()}{' '}
          {search.searchResult.total === 1 ? 'indicator' : 'indicators'}
        </h2>
        {!areas ? (
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
        ) : null}
      </div>
      {dataSelected.length > 0 ? (
        <DownloadShareData
          inline
          href={`${path}/table.csv?${params}`}
          allDataHref={`${path}/table.csv?tab-topic=data`}
          downloadLabel="Download filtered data (CSV)"
          allDataLabel="Download all data (CSV)"
        />
      ) : null}
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
          {data.data.areasLimited && !data.defaultAreas ? (
            <InsetText>
              Showing the first {data.data.selectedAreas.length} areas. Select fewer areas to change
              which ones are shown.
            </InsetText>
          ) : null}
          <AreaSummariesTable
            selected={dataSelected}
            geography={data.data.benchmarkGeography}
            topicSlug={topic.slug}
          />
        </>
      ) : (
        <TopicDataTable
          selected={dataSelected}
          title={topic.title}
          topicSlug={topic.slug}
          columns={topicColumns(params)}
        />
      )}
    </>
  );
}

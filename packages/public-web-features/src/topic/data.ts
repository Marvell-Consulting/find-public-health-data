import { periodLabel } from '@fphd/utils/period-label';
import {
  type ComparisonRow,
  comparisonRows,
  filterObservations,
  sameSegment,
  trendSeries,
} from '../indicator/data.ts';
import type { SelectedIndicator } from '../indicator/loader.ts';
import type { IndicatorSearchRow } from '../search/loader.ts';
export const TOPIC_SORTS = [
  { value: 'subtopic-asc', label: 'Subtopic (A to Z)' },
  { value: 'subtopic-desc', label: 'Subtopic (Z to A)' },
  { value: 'name-asc', label: 'Indicator name (A to Z)' },
  { value: 'name-desc', label: 'Indicator name (Z to A)' },
  { value: 'period-desc', label: 'Most recent data first' },
  { value: 'trend-desc', label: 'Trend: increasing first' },
  { value: 'trend-asc', label: 'Trend: decreasing first' },
  { value: 'trend-better', label: 'Trend: getting better first' },
  { value: 'trend-worse', label: 'Trend: getting worse first' },
];

export const TOPIC_SORT_OPTIONS = TOPIC_SORTS;
export const TOPIC_AREA_GROUPS = [
  'Integrated care boards',
  'Local authorities',
  'NHS regions',
  'Statistical regions',
];

export const TOPIC_COLUMNS = [
  { value: 'period', label: 'Most recent period' },
  { value: 'updated', label: 'Last updated' },
  { value: 'trend', label: 'Trend (last 5 periods)' },
  { value: 'count', label: 'Count' },
  { value: 'value', label: 'Calculated value' },
] as const;
export type TopicColumn = (typeof TOPIC_COLUMNS)[number]['value'];
export function topicColumns(params: URLSearchParams): TopicColumn[] {
  const selected = params.has('columns-topic')
    ? params.getAll('columns-topic').flatMap((value) => value.split(','))
    : ['period', 'updated', 'trend', 'value'];
  return TOPIC_COLUMNS.map(({ value }) => value).filter((value) => selected.includes(value));
}

export function topicSubtopics(entry: SelectedIndicator, topicSlug: string): string[] {
  return (
    entry.detail.topics
      .find(({ slug }) => slug === topicSlug)
      ?.subtopics?.map(({ title }) => title) ?? []
  );
}

export function topicIndicators(
  indicators: IndicatorSearchRow[],
  params: URLSearchParams,
  pagination?: { page?: number | undefined; total: number; limit: number },
) {
  const sort =
    TOPIC_SORTS.find(({ value }) => value === params.get('sort'))?.value ?? 'subtopic-asc';
  if (pagination)
    return {
      sort,
      page: 1,
      pages: 1,
      indicators,
    };
  const sorted = [...indicators].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') sorted.reverse();
  return {
    sort,
    page: 1,
    pages: 1,
    indicators: sorted,
  };
}

export function englandObservation(
  entry: SelectedIndicator,
  row: Pick<ComparisonRow, 'sex' | 'periodType' | 'series'>,
) {
  const england = entry.areaData.find(({ areaCode }) => areaCode === 'E92000001');
  const period = row.series.at(-1);
  const series = trendSeries(
    filterObservations(england?.observations ?? [], row).filter(
      (observation) => !period || sameSegment(observation, period),
    ),
  );
  return period
    ? series.find(
        ({ fromDate, toDate }) => fromDate === period.fromDate && toDate === period.toDate,
      )
    : series.at(-1);
}

export function observationPeriod(
  entry: SelectedIndicator,
  observation: Parameters<typeof periodLabel>[0] | undefined,
) {
  return observation ? periodLabel(observation, entry.detail.yearType) : 'No data';
}

/** Keep the displayed series and their same-period benchmarks out of the full observation history. */
export function topicTableSelection(selected: SelectedIndicator[]): SelectedIndicator[] {
  return selected.map((entry) => {
    const rows = comparisonRows([entry]);
    const keep = new Set<SelectedIndicator['areaData'][number]['observations'][number]>();
    for (const row of rows) {
      const england = entry.areaData.find(({ areaCode }) => areaCode === 'E92000001');
      const benchmarkSeries = trendSeries(filterObservations(england?.observations ?? [], row));
      for (const point of benchmarkSeries.filter(({ value }) => value !== null).slice(-5))
        keep.add(point);
      const benchmarkLatest = benchmarkSeries.at(-1);
      if (benchmarkLatest) keep.add(benchmarkLatest);
      for (const cell of row.cells) {
        for (const point of cell.series.filter(({ value }) => value !== null).slice(-5))
          keep.add(point);
        const latest = cell.series.at(-1);
        if (latest) keep.add(latest);
        const england = englandObservation(entry, { ...row, series: cell.series });
        if (england) keep.add(england);
      }
    }
    return {
      ...entry,
      areaData: entry.areaData.map((area) => ({
        ...area,
        observations: area.observations.filter((point) => keep.has(point)),
      })),
    };
  });
}

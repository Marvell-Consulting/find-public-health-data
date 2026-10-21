import {
  type ComparisonRow,
  comparisonRows,
  filterObservations,
  periodLabel,
  sameSegment,
  trendSeries,
} from '../indicator/data.ts';
import type { SelectedIndicator } from '../indicator/loader.ts';
import type { IndicatorSearchRow } from '../search/loader.ts';
import { MAX_SELECTED_INDICATORS } from '../selection-limits.ts';

export const TOPIC_PAGE_SIZE = MAX_SELECTED_INDICATORS;
export const TOPIC_SORTS = [
  { value: 'name-asc', label: 'Indicator name - A to Z' },
  { value: 'name-desc', label: 'Indicator name - Z to A' },
  { value: 'period-desc', label: 'Most recent period' },
  { value: 'trend-desc', label: 'Trend increasing to decreasing' },
  { value: 'trend-asc', label: 'Trend decreasing to increasing' },
];

export const TOPIC_SORT_OPTIONS = [
  ...TOPIC_SORTS,
  { value: 'subtopic-asc', label: 'Subtopic - A to Z (coming soon)', disabled: true },
  { value: 'subtopic-desc', label: 'Subtopic - Z to A (coming soon)', disabled: true },
];

export function topicIndicators(
  indicators: IndicatorSearchRow[],
  params: URLSearchParams,
  pagination?: { page?: number | undefined; total: number; limit: number },
) {
  const sort = TOPIC_SORTS.find(({ value }) => value === params.get('sort'))?.value ?? 'name-asc';
  if (pagination?.page)
    return {
      sort,
      page: pagination.page,
      pages: Math.max(1, Math.ceil(pagination.total / pagination.limit)),
      indicators,
    };
  const sorted = [...indicators].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') sorted.reverse();
  const pages = Math.max(1, Math.ceil(sorted.length / TOPIC_PAGE_SIZE));
  const requested = Number(params.get('page'));
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  return {
    sort,
    page,
    pages,
    indicators: sorted.slice((page - 1) * TOPIC_PAGE_SIZE, page * TOPIC_PAGE_SIZE),
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

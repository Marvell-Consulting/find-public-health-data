import type {
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
} from '@fphd/public-api-features/contract';

export function periodLabel({
  fromDate,
  toDate,
}: Pick<IndicatorObservation, 'fromDate' | 'toDate'>): string {
  const fromYear = fromDate.slice(0, 4);
  const toYear = toDate.slice(0, 4);
  return fromYear === toYear ? fromYear : `${fromYear} to ${toYear}`;
}

export function segmentLabel(observation: IndicatorObservation): string {
  if (observation.dimensions.length === 0) {
    return 'All';
  }
  return observation.dimensions.map((dimension) => dimension.value).join(', ');
}

function segmentKey(observation: IndicatorObservation): string {
  return observation.dimensions
    .map((dimension) => `${dimension.type}:${dimension.value}`)
    .join('|');
}

function sortOrderSum(observation: IndicatorObservation): number {
  return observation.dimensions.reduce((sum, dimension) => sum + dimension.sortOrder, 0);
}

/**
 * The least-disaggregated segment's observations in period order — the closest thing the
 * data has to a headline series. Where several segments tie on dimension count, the one
 * with the most observations wins, as the longest series is the most useful trend.
 */
export function trendSeries(observations: IndicatorObservation[]): IndicatorObservation[] {
  if (observations.length === 0) {
    return [];
  }

  const minDimensions = Math.min(...observations.map((o) => o.dimensions.length));
  const candidates = observations.filter((o) => o.dimensions.length === minDimensions);

  const seriesSizes = new Map<string, number>();
  for (const observation of candidates) {
    const key = segmentKey(observation);
    seriesSizes.set(key, (seriesSizes.get(key) ?? 0) + 1);
  }
  const [longestSeriesKey] = [...seriesSizes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [''];

  return candidates
    .filter((observation) => segmentKey(observation) === longestSeriesKey)
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate));
}

/**
 * The latest period's breakdown across core segments (sex/age), for the segmentation
 * overview table. Where a single-year and a rolling period share the latest end date, the
 * shorter period wins.
 */
export function latestCoreSegments(observations: IndicatorObservation[]): IndicatorObservation[] {
  const core = observations.filter((observation) =>
    observation.dimensions.every((dimension) => dimension.dimensionClass === 'core'),
  );
  if (core.length === 0) {
    return [];
  }

  const latestToDate = core
    .map((o) => o.toDate)
    .sort()
    .at(-1);
  const endingLatest = core.filter((o) => o.toDate === latestToDate);
  const latestFromDate = endingLatest
    .map((o) => o.fromDate)
    .sort()
    .at(-1);

  return endingLatest
    .filter((o) => o.fromDate === latestFromDate)
    .sort(
      (a, b) =>
        a.dimensions.length - b.dimensions.length ||
        sortOrderSum(a) - sortOrderSum(b) ||
        segmentLabel(a).localeCompare(segmentLabel(b)),
    );
}

const valueFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

export function formatValue(value: number | null): string {
  return value === null ? 'No data' : valueFormat.format(value);
}

export function formatConfidenceInterval(observation: IndicatorObservation): string {
  if (observation.lowerCi95 === null || observation.upperCi95 === null) {
    return '—';
  }
  return `${valueFormat.format(observation.lowerCi95)} to ${valueFormat.format(observation.upperCi95)}`;
}

export interface ComparisonRow {
  fingertipsId: number;
  name: string;
  unit: string;
  areaName: string;
  period: string;
  segment: string;
  value: number | null;
  count: number | null;
}

/**
 * One row per selected indicator for the comparison table: its most recent value in the
 * first selected area. Indicators with no data for that area are still listed, so a user
 * comparing several can see which have nothing rather than wondering where a row went.
 */
export function comparisonRows(
  selected: { detail: IndicatorDetail; areaData: IndicatorAreaData[] }[],
): ComparisonRow[] {
  return selected.map(({ detail, areaData }) => {
    const first = areaData[0];
    const latest = first ? trendSeries(first.observations).at(-1) : undefined;

    return {
      fingertipsId: detail.fingertipsId,
      name: detail.name,
      unit: detail.unit.name,
      areaName: first?.areaName ?? '',
      period: latest ? periodLabel(latest) : '',
      segment: latest ? segmentLabel(latest) : '',
      value: latest?.value ?? null,
      count: latest?.count ?? null,
    };
  });
}

/**
 * The latest period's values broken down by an inequality dimension (deprivation,
 * ethnicity, and the like) rather than the core sex/age segmentation. One dimension only:
 * mixing several in a single table would compare values that are not comparable.
 */
export function inequalitySegments(observations: IndicatorObservation[]): IndicatorObservation[] {
  const withInequality = observations.filter((observation) =>
    observation.dimensions.some(({ dimensionClass }) => dimensionClass === 'inequality'),
  );
  if (withInequality.length === 0) {
    return [];
  }

  const latestToDate = withInequality
    .map(({ toDate }) => toDate)
    .sort()
    .at(-1);
  const latest = withInequality.filter(({ toDate }) => toDate === latestToDate);
  const latestFromDate = latest
    .map(({ fromDate }) => fromDate)
    .sort()
    .at(-1);
  const period = latest.filter(({ fromDate }) => fromDate === latestFromDate);

  // Whichever inequality dimension has the most values in that period is the one with a
  // story to tell; the others would each render a table of one or two rows.
  const counts = new Map<string, number>();
  for (const observation of period) {
    for (const { type, dimensionClass } of observation.dimensions) {
      if (dimensionClass === 'inequality') {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
  }
  const [chosen] =
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];

  return period
    .filter((observation) => observation.dimensions.some(({ type }) => type === chosen))
    .sort(
      (a, b) =>
        a.dimensions.reduce((sum, d) => sum + d.sortOrder, 0) -
          b.dimensions.reduce((sum, d) => sum + d.sortOrder, 0) ||
        segmentLabel(a).localeCompare(segmentLabel(b)),
    );
}

export type PeriodType = 'all' | '1-year' | '3-year';

/** A period spanning appreciably more than a year is a rolling average. */
function isRolling({ fromDate, toDate }: IndicatorObservation): boolean {
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000;
  return days > 400;
}

export function periodTypeLabel(periodType: PeriodType): string {
  return periodType === '1-year' ? '1 year' : periodType === '3-year' ? '3 year rolling' : 'All';
}

/** The distinct values of one dimension across an indicator's observations, in sort order. */
export function dimensionValues(
  observations: IndicatorObservation[],
  dimensionType: string,
): string[] {
  const bySortOrder = new Map<string, number>();
  for (const observation of observations) {
    for (const dimension of observation.dimensions) {
      if (dimension.type === dimensionType) {
        bySortOrder.set(dimension.value, dimension.sortOrder);
      }
    }
  }
  return [...bySortOrder.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([value]) => value);
}

export interface ObservationFilter {
  sex?: string;
  periodType?: PeriodType;
}

/**
 * Narrows observations to what the chart and table options ask for. An observation that
 * carries no Sex dimension is kept whatever the sex filter says: it is the value for all
 * people, which stays meaningful alongside a single sex.
 */
export function filterObservations(
  observations: IndicatorObservation[],
  { sex, periodType = 'all' }: ObservationFilter,
): IndicatorObservation[] {
  return observations.filter((observation) => {
    if (periodType !== 'all' && isRolling(observation) !== (periodType === '3-year')) {
      return false;
    }
    if (!sex) {
      return true;
    }
    const observationSex = observation.dimensions.find(({ type }) => type === 'Sex');
    return observationSex === undefined || observationSex.value === sex;
  });
}

/**
 * A comparison row's bar width as a percentage of the largest value sharing its unit.
 * Scaling per unit keeps a percentage from being dwarfed by a rate per 100,000.
 */
export function barWidth(row: ComparisonRow, rows: ComparisonRow[]): number {
  if (row.value === null) {
    return 0;
  }
  const peers = rows.filter((other) => other.unit === row.unit && other.value !== null);
  const largest = Math.max(...peers.map((other) => Math.abs(other.value ?? 0)));
  if (largest === 0) {
    return 0;
  }
  return Math.max(2, Math.round((Math.abs(row.value) / largest) * 100));
}

export type ConfidenceLevel = 'none' | '95' | '99.8';

export function confidenceInterval(
  observation: IndicatorObservation,
  level: ConfidenceLevel,
): string {
  if (level === 'none') {
    return '';
  }
  const lower = level === '95' ? observation.lowerCi95 : observation.lowerCi998;
  const upper = level === '95' ? observation.upperCi95 : observation.upperCi998;
  if (lower === null || upper === null || lower === undefined || upper === undefined) {
    return '—';
  }
  return `${valueFormat.format(lower)} to ${valueFormat.format(upper)}`;
}

/** Every inequality dimension an indicator reports, for the category chooser. */
export function inequalityCategories(observations: IndicatorObservation[]): string[] {
  const types = new Set<string>();
  for (const observation of observations) {
    for (const { type, dimensionClass } of observation.dimensions) {
      if (dimensionClass === 'inequality') {
        types.add(type);
      }
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b));
}

/** The periods an indicator reports for one inequality category, most recent last. */
export function inequalityPeriods(
  observations: IndicatorObservation[],
  category: string,
): { value: string; label: string }[] {
  const periods = new Map<string, string>();
  for (const observation of observations) {
    if (observation.dimensions.some(({ type }) => type === category)) {
      periods.set(`${observation.fromDate}/${observation.toDate}`, periodLabel(observation));
    }
  }
  return [...periods.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, label]) => ({ value, label }));
}

/** One inequality category's values for one period, in the dimension's own order. */
export function inequalityBreakdown(
  observations: IndicatorObservation[],
  category: string,
  period: string,
): IndicatorObservation[] {
  return observations
    .filter(
      (observation) =>
        `${observation.fromDate}/${observation.toDate}` === period &&
        observation.dimensions.some(({ type }) => type === category),
    )
    .sort(
      (a, b) =>
        a.dimensions.reduce((sum, d) => sum + d.sortOrder, 0) -
          b.dimensions.reduce((sum, d) => sum + d.sortOrder, 0) ||
        segmentLabel(a).localeCompare(segmentLabel(b)),
    );
}

/** The span an indicator's data covers, as the summary table states it. */
export function periodCovered(observations: IndicatorObservation[]): string {
  if (observations.length === 0) {
    return '';
  }
  const from = observations
    .map(({ fromDate }) => fromDate)
    .sort()[0]
    ?.slice(0, 4);
  const to = observations
    .map(({ toDate }) => toDate)
    .sort()
    .at(-1)
    ?.slice(0, 4);
  return from === to ? (from ?? '') : `${from} to ${to}`;
}

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

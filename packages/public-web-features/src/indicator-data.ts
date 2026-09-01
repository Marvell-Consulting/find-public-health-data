import type {
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
} from '@fphd/public-api-features/contract';

import { cleanAreaName } from './geography-display';

export function periodLabel(
  { fromDate, toDate }: Pick<IndicatorObservation, 'fromDate' | 'toDate'>,
  yearType?: string,
): string {
  const fromYear = fromDate.slice(0, 4);
  const toYear = toDate.slice(0, 4);
  if (fromYear === toYear) {
    return fromYear;
  }
  // A financial year spans two calendar years but is one period: 2009/10, not
  // "2009 to 2010" — which the prototype reserves for genuine ranges.
  const days = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000;
  if (yearType === 'Financial' && days <= 400) {
    return `${fromYear}/${toYear.slice(2)}`;
  }
  return `${fromYear} to ${toYear}`;
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

/** The observation's dimension values joined the way the range API labels segments:
 *  '|'-separated in dimension-type order (the API sorts dimensions by type). */
export function segmentValuesKey(observation: IndicatorObservation): string {
  return observation.dimensions.map(({ value }) => value).join('|');
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
 * The trend series aligned to a reference observation's segment. Every column of a
 * table must describe the same population: an always-sexed indicator has no aggregate
 * series, and left to their own devices two areas can settle on different sexes as
 * their "longest" series — a Female column silently compared against a Male benchmark.
 * Falls back to the area's own trend series when it never publishes the reference
 * segment.
 */
export function alignedTrendSeries(
  observations: IndicatorObservation[],
  reference: IndicatorObservation | undefined,
): IndicatorObservation[] {
  if (!reference) {
    return trendSeries(observations);
  }
  const key = segmentKey(reference);
  const matching = observations
    .filter((observation) => segmentKey(observation) === key)
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate));
  return matching.length > 0 ? matching : trendSeries(observations);
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

const calculatedValueFormat = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Calculated values always show one decimal place ("6.0%"), matching Fingertips. */
export function formatCalculatedValue(value: number | null): string {
  return value === null ? 'No data' : calculatedValueFormat.format(value);
}

export function formatConfidenceInterval(observation: IndicatorObservation): string {
  if (observation.lowerCi95 === null || observation.upperCi95 === null) {
    return '—';
  }
  return `${valueFormat.format(observation.lowerCi95)} to ${valueFormat.format(observation.upperCi95)}`;
}

export interface ComparisonCell {
  areaCode: string;
  areaName: string;
  value: number | null;
  count: number | null;
  /** The cell's own series, for the recent-trend calculation. */
  series: IndicatorObservation[];
  /** Note texts attached to the latest value. */
  notes: string[];
}

export interface ComparisonRow {
  fingertipsId: number;
  /** Distinguishes breakout rows of one indicator ("Female, 1 year"). */
  key: string;
  name: string;
  suffix: string;
  unit: string;
  unitLabel: string;
  areaName: string;
  period: string;
  value: number | null;
  count: number | null;
  series: IndicatorObservation[];
  notes: string[];
  /** The variant behind a breakout row, so a benchmark can be filtered the same way. */
  sex: string;
  periodType: PeriodType;
  /** One cell per compared area, aligned with comparisonAreas(). */
  cells: ComparisonCell[];
}

/**
 * The areas the comparison table sets side by side: every selected area, except that
 * England steps back once real areas are picked — the same rule as the trend table.
 */
export function comparisonAreas(areaData: IndicatorAreaData[]): IndicatorAreaData[] {
  const nonEngland = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  return nonEngland.length > 0 ? nonEngland : areaData;
}

const PERIOD_TYPE_SUFFIX: Record<Exclude<PeriodType, 'all'>, string> = {
  '1-year': '1 year',
  '3-year': '3 year rolling average',
};

/**
 * The comparison table's rows: normally one per indicator (its least-disaggregated
 * series), but an indicator that is always sexed has no such aggregate, so it breaks out
 * one row per sex — and per period shape where it publishes both — as the prototype does
 * for life expectancy. Indicators with no data still get a row rather than vanishing.
 */
export function comparisonRows(
  selected: { detail: IndicatorDetail; areaData: IndicatorAreaData[] }[],
): ComparisonRow[] {
  return selected.flatMap(({ detail, areaData }) => {
    const first = areaData[0];
    const observations = first?.observations ?? [];
    const sexes = dimensionValues(observations, 'Sex');
    const hasAggregate = observations.some(
      (observation) => !observation.dimensions.some(({ type }) => type === 'Sex'),
    );
    const periodTypes = availablePeriodTypes(observations);

    const variants =
      sexes.length === 0 || hasAggregate
        ? [{ sex: '', periodType: 'all' as PeriodType, suffix: '' }]
        : sexes.flatMap((sex) =>
            (periodTypes.length > 1 ? periodTypes : (['all'] as PeriodType[])).map(
              (periodType) => ({
                sex,
                periodType,
                suffix:
                  periodType === 'all' ? `(${sex})` : `(${sex}, ${PERIOD_TYPE_SUFFIX[periodType]})`,
              }),
            ),
          );

    const areas = comparisonAreas(areaData);
    const cellFor = (data: IndicatorAreaData, variant: (typeof variants)[number]) => {
      const series = trendSeries(
        filterObservations(data.observations, {
          sex: variant.sex,
          periodType: variant.periodType,
        }),
      );
      const latest = series.at(-1);
      return {
        areaCode: data.areaCode,
        areaName: cleanAreaName(data.areaName),
        value: latest?.value ?? null,
        count: latest?.count ?? null,
        series,
        notes: latest?.notes.map(({ text }) => text) ?? [],
      };
    };

    const rows = variants.flatMap((variant) => {
      const cells = areas.map((data) => cellFor(data, variant));
      const firstWithData = cells.find(({ series }) => series.length > 0);
      const latest = firstWithData?.series.at(-1);
      if (!latest) {
        return [];
      }
      return [
        {
          fingertipsId: detail.fingertipsId,
          key: `${detail.fingertipsId}|${variant.suffix}`,
          name: detail.name,
          suffix: variant.suffix,
          unit: detail.unit.name,
          unitLabel: detail.unit.label,
          areaName: firstWithData?.areaName ?? '',
          period: periodLabel(latest, detail.yearType),
          value: firstWithData?.value ?? null,
          count: firstWithData?.count ?? null,
          series: firstWithData?.series ?? [],
          notes: firstWithData?.notes ?? [],
          sex: variant.sex,
          periodType: variant.periodType,
          cells,
        },
      ];
    });

    return rows.length > 0
      ? rows
      : [
          {
            fingertipsId: detail.fingertipsId,
            key: String(detail.fingertipsId),
            name: detail.name,
            suffix: '',
            unit: detail.unit.name,
            unitLabel: detail.unit.label,
            areaName: first?.areaName ?? '',
            period: '',
            value: null,
            count: null,
            series: [],
            notes: [],
            sex: '',
            periodType: 'all' as PeriodType,
            cells: [],
          },
        ];
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

/**
 * The period shapes an indicator actually publishes. Many indicators are single-year
 * only (QOF prevalence) or rolling only (life expectancy), so the period filter must
 * offer just the shapes present or a choice can never match anything.
 */
export function availablePeriodTypes(observations: IndicatorObservation[]): PeriodType[] {
  const types: PeriodType[] = [];
  if (observations.some((observation) => !isRolling(observation))) {
    types.push('1-year');
  }
  if (observations.some(isRolling)) {
    types.push('3-year');
  }
  return types;
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
 * Narrows observations to what the chart and table options ask for. Choosing a sex keeps
 * only that sex's observations — the sexless all-people series would otherwise always win
 * as the least-disaggregated segment and the selection would appear to do nothing.
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
    return observation.dimensions.some(({ type, value }) => type === 'Sex' && value === sex);
  });
}

export type ConfidenceLevel = 'none' | '95' | '99.8';

/** The interval levels the data actually carries; the filter offers nothing emptier. */
export function availableConfidenceLevels(
  observations: IndicatorObservation[],
): Exclude<ConfidenceLevel, 'none'>[] {
  const levels: Exclude<ConfidenceLevel, 'none'>[] = [];
  if (observations.some(({ lowerCi95, upperCi95 }) => lowerCi95 !== null || upperCi95 !== null)) {
    levels.push('95');
  }
  if (
    observations.some(({ lowerCi998, upperCi998 }) => lowerCi998 !== null || upperCi998 !== null)
  ) {
    levels.push('99.8');
  }
  return levels;
}

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

/**
 * Purely this category's breakdown of the indicator's own baseline segment: beyond the
 * category dimension, only the dimensions the headline series always carries (QOF
 * prevalence's "Age 17+", a wholly-sexed indicator's aligned sex) may appear. A decile
 * split further by sex belongs to a combined view the prototype does not offer.
 */
function isPureCategory(
  observation: IndicatorObservation,
  category: string,
  reference: IndicatorObservation | undefined,
): boolean {
  const rest = observation.dimensions.filter(({ type }) => type !== category);
  if (rest.length === observation.dimensions.length) {
    return false;
  }
  const baseline = reference?.dimensions ?? [];
  return (
    rest.length === baseline.length &&
    rest.every(({ type, value }) =>
      baseline.some((dimension) => dimension.type === type && dimension.value === value),
    )
  );
}

/**
 * Pholio's inequality dimension names carry internal qualifiers ("in England", "4/23
 * geography") the prototype's category labels drop. Where shortening makes two
 * categories collide (the same deciles across boundary revisions), the geography
 * qualifier stays as the differentiator.
 */
export function inequalityCategoryLabel(type: string, keepGeography = false): string {
  const label = type
    .replace('County & UA', 'County and unitary authority')
    .replace('District & UA', 'District and unitary authority')
    .replace(' in England', '')
    .replace(' within area', '');
  return keepGeography ? label : label.replace(/,\s*\d+\/\d+ geography/, '');
}

/** The category select's options, disambiguated where shortened labels collide. */
export function inequalityCategoryOptions(
  categories: string[],
): { label: string; value: string }[] {
  const counts = new Map<string, number>();
  for (const value of categories) {
    const label = inequalityCategoryLabel(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return categories.map((value) => {
    const label = inequalityCategoryLabel(value);
    return {
      label: (counts.get(label) ?? 0) > 1 ? inequalityCategoryLabel(value, true) : label,
      value,
    };
  });
}

/** The periods an indicator reports for one inequality category, most recent last. */
export function inequalityPeriods(
  observations: IndicatorObservation[],
  category: string,
  yearType?: string,
): { value: string; label: string }[] {
  const reference = trendSeries(observations)[0];
  const periods = new Map<string, string>();
  for (const observation of observations) {
    if (isPureCategory(observation, category, reference)) {
      periods.set(
        `${observation.fromDate}/${observation.toDate}`,
        periodLabel(observation, yearType),
      );
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
  const reference = trendSeries(observations)[0];
  return observations
    .filter(
      (observation) =>
        `${observation.fromDate}/${observation.toDate}` === period &&
        isPureCategory(observation, category, reference),
    )
    .sort(
      (a, b) =>
        a.dimensions.reduce((sum, d) => sum + d.sortOrder, 0) -
          b.dimensions.reduce((sum, d) => sum + d.sortOrder, 0) ||
        segmentLabel(a).localeCompare(segmentLabel(b)),
    );
}

/** The span an indicator's data covers, as the summary table states it. */
export function periodCovered(observations: IndicatorObservation[], yearType?: string): string {
  if (observations.length === 0) {
    return '';
  }
  const sorted = [...observations].sort(
    (a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate),
  );
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) {
    return '';
  }
  const from = periodLabel(first, yearType);
  const to = periodLabel(last, yearType);
  return from === to ? from : `${from} to ${to}`;
}

export type RecentTrend =
  | { direction: 'up' | 'down'; label: string; tone: 'green' | 'red' | 'blue' }
  | { direction: 'right'; label: string; tone: 'yellow' }
  | { direction: null; label: string; tone: 'grey' };

/**
 * Direction of the latest five aggregate values, read with the indicator's polarity so
 * the tag can say whether the movement is good. A change smaller than 2% of the series
 * mean is reported as no significant change rather than a trend.
 */
export function recentTrend(
  observations: IndicatorObservation[],
  polarity: string | null,
): RecentTrend {
  const series = trendSeries(observations).filter(({ value }) => value !== null);
  if (series.length < 5) {
    return { direction: null, label: 'Trend cannot be calculated', tone: 'grey' };
  }
  const latest = series.slice(-5).map(({ value }) => value as number);
  const change = (latest.at(-1) ?? 0) - (latest[0] ?? 0);
  const mean = latest.reduce((sum, value) => sum + value, 0) / latest.length;
  if (mean === 0 || Math.abs(change) < Math.abs(mean) * 0.02) {
    return { direction: 'right', label: 'No significant change', tone: 'yellow' };
  }
  const direction = change > 0 ? 'up' : 'down';
  const lowIsGood = polarity?.toLowerCase().includes('low is good') ?? false;
  const highIsGood = polarity?.toLowerCase().includes('high is good') ?? false;
  const word = direction === 'up' ? 'Increasing' : 'Decreasing';
  if (!lowIsGood && !highIsGood) {
    return { direction, label: word, tone: 'blue' };
  }
  const better = (direction === 'down') === lowIsGood;
  return {
    direction,
    label: `${word} and getting ${better ? 'better' : 'worse'}`,
    tone: better ? 'green' : 'red',
  };
}

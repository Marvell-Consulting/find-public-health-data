import type { BenchmarkChoice } from './comparison.ts';
import { alignedTrendSeries, type ConfidenceLevel, segmentValuesKey, trendSeries } from './data.ts';
import type {
  BenchmarkGeography,
  IndicatorAreaData,
  IndicatorObservation,
  IndicatorRangePeriod,
} from './loader.ts';

export interface AreaBenchmark {
  name: string;
  series: IndicatorObservation[];
  rangePeriods: IndicatorRangePeriod[];
}

export function trendTableModel({
  areaData,
  benchmark = 'none',
  confidence,
  geography = { regionByCode: {}, levelByCode: {} },
  ranges = {},
  regionData = [],
}: {
  areaData: IndicatorAreaData[];
  benchmark?: BenchmarkChoice;
  confidence: ConfidenceLevel;
  geography?: BenchmarkGeography;
  ranges?: Record<string, IndicatorRangePeriod[]>;
  regionData?: IndicatorAreaData[];
}) {
  const nonEngland = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  const england = areaData.filter(({ areaCode }) => areaCode === 'E92000001');
  const shownAreas = nonEngland.length === 0 ? areaData : nonEngland;
  const benchmarkActive = benchmark !== 'none' && nonEngland.length > 0;
  const reference = shownAreas[0] ? trendSeries(shownAreas[0].observations)[0] : undefined;
  const referenceSegment = reference ? segmentValuesKey(reference) : '';
  const seriesFor = (observations: IndicatorObservation[]) =>
    alignedTrendSeries(observations, reference);
  const englandSeries = england[0] ? seriesFor(england[0].observations) : [];
  const benchmarkFor = (areaCode: string): AreaBenchmark | undefined => {
    if (!benchmarkActive) return undefined;
    if (benchmark === 'england') {
      return {
        name: 'England',
        series: englandSeries,
        rangePeriods: ranges[geography.levelByCode[areaCode] ?? ''] ?? [],
      };
    }
    const region = geography.regionByCode[areaCode];
    if (!region) return undefined;
    const data = regionData.find(({ areaCode: code }) => code === region.code);
    return {
      name: `${region.name} (Statistical region)`,
      series: data ? seriesFor(data.observations) : [],
      rangePeriods: ranges['Statistical regions'] ?? [],
    };
  };
  const seriesByArea = shownAreas
    .map((data) => ({ data, series: seriesFor(data.observations) }))
    .filter(({ series }) => series.length > 0);
  const benchmarks = new Map(
    seriesByArea.map(({ data }) => [data.areaCode, benchmarkFor(data.areaCode)]),
  );
  const periods = [
    ...new Map(
      shownAreas
        .flatMap(({ observations }) => seriesFor(observations))
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate))
        .map((observation) => [
          `${observation.fromDate}|${observation.toDate}`,
          { fromDate: observation.fromDate, toDate: observation.toDate },
        ]),
    ).values(),
  ];
  const inPeriod =
    (period: (typeof periods)[number]) => (row: { fromDate: string; toDate: string }) =>
      row.fromDate === period.fromDate && row.toDate === period.toDate;
  const hasCounts = seriesByArea.some(({ series }) => series.some(({ count }) => count !== null));
  const lowerOf = (observation: IndicatorObservation) =>
    confidence === '99.8' ? observation.lowerCi998 : observation.lowerCi95;
  const upperOf = (observation: IndicatorObservation) =>
    confidence === '99.8' ? observation.upperCi998 : observation.upperCi95;

  return {
    benchmarks,
    firstObservation: seriesByArea[0]?.series[0],
    hasCounts,
    inPeriod,
    lowerOf,
    periods,
    referenceSegment,
    seriesByArea,
    upperOf,
  };
}

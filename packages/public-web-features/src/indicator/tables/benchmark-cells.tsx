import type { ReactNode } from 'react';
import { type BenchmarkJudgement, benchmarkJudgement, formatCalculatedValue } from '../data';
import type { IndicatorDetail, IndicatorObservation, IndicatorRangePeriod } from '../loader';

// Fingertips' marker colours: RAG significance, BOB sides, an open ring for no comparison.
const DOT_STYLES: Record<BenchmarkJudgement, { fill: string; stroke?: string }> = {
  better: { fill: '#8ED973' },
  similar: { fill: '#FFC000' },
  worse: { fill: '#D4351C' },
  lower: { fill: '#12436D' },
  higher: { fill: '#5694CA' },
  none: { fill: '#ffffff', stroke: '#505a5f' },
};

/**
 * Dot-and-whisker comparison: the grey line spans the min–max range across every area
 * of the benchmark's level, the black tick is the benchmark's own value, and the dot
 * is this area's value.
 */
function RangePlot({
  value,
  benchmarkValue,
  min,
  max,
  judgement,
  label,
}: {
  value: number;
  benchmarkValue: number;
  min: number;
  max: number;
  judgement: BenchmarkJudgement;
  label: string;
}) {
  const span = max - min;
  const toX = (v: number) =>
    span <= 0 ? 60 : Math.max(10, Math.min(110, 10 + ((v - min) / span) * 100));
  const benchmarkX = toX(benchmarkValue);
  const areaX = toX(value);
  const dot = DOT_STYLES[judgement];
  return (
    <svg
      aria-label={label}
      className="fphd-range-plot"
      height="24"
      role="img"
      viewBox="0 0 120 24"
      width="120"
    >
      <line stroke="#b1b4b6" strokeWidth="2" x1="10" x2="110" y1="12" y2="12" />
      <line stroke="#b1b4b6" strokeWidth="2" x1="10" x2="10" y1="8" y2="16" />
      <line stroke="#b1b4b6" strokeWidth="2" x1="110" x2="110" y1="8" y2="16" />
      <line stroke="#0b0c0c" strokeWidth="2" x1={benchmarkX} x2={benchmarkX} y1="5" y2="19" />
      <circle
        cx={areaX}
        cy="12"
        fill={dot.fill}
        r="5"
        stroke={dot.stroke}
        strokeWidth={dot.stroke ? 1.5 : 0}
      />
    </svg>
  );
}

const BENCHMARK_HEADER = 'govuk-table__header fphd-trend-table__benchmark-cell';
const BENCHMARK_CELL = 'govuk-table__cell fphd-trend-table__benchmark-cell';

/** The benchmark group's sub-headers: its value, and the spread when the range is on. */
export function BenchmarkHeaderCells({
  showRange,
  unit,
}: {
  showRange: boolean;
  unit?: ReactNode;
}) {
  return (
    <>
      <th scope="col" className={BENCHMARK_HEADER}>
        Calculated value{unit}
      </th>
      {showRange ? (
        <>
          <th scope="col" className={BENCHMARK_HEADER}>
            Minimum
          </th>
          <th scope="col" className={BENCHMARK_HEADER}>
            Maximum
          </th>
          <th scope="col" className={BENCHMARK_HEADER}>
            Comparison
          </th>
        </>
      ) : null}
    </>
  );
}

type ComparableObservation = Pick<
  IndicatorObservation,
  'value' | 'lowerCi95' | 'upperCi95' | 'lowerCi998' | 'upperCi998'
>;

/** One row's benchmark cells: the value, and min/max/plot when the range is on. */
export function BenchmarkCells({
  areaName,
  areaObservation,
  benchmarkName,
  benchmarkValue,
  confidence = '95',
  format,
  indicator,
  rangePeriod,
  showRange,
}: {
  areaName: string;
  areaObservation: ComparableObservation | undefined;
  benchmarkName: string;
  benchmarkValue: number | null;
  confidence?: '95' | '99.8';
  format: (value: number) => ReactNode;
  indicator: Pick<IndicatorDetail, 'polarity' | 'comparatorMethod'>;
  rangePeriod: IndicatorRangePeriod | undefined;
  showRange: boolean;
}) {
  const areaValue = areaObservation?.value ?? null;
  return (
    <>
      <td className={BENCHMARK_CELL}>{benchmarkValue == null ? '-' : format(benchmarkValue)}</td>
      {showRange ? (
        <>
          <td className={BENCHMARK_CELL}>{rangePeriod ? format(rangePeriod.min) : '-'}</td>
          <td className={BENCHMARK_CELL}>{rangePeriod ? format(rangePeriod.max) : '-'}</td>
          <td className={BENCHMARK_CELL}>
            {rangePeriod && areaValue != null && benchmarkValue != null ? (
              <RangePlot
                value={areaValue}
                benchmarkValue={benchmarkValue}
                min={rangePeriod.min}
                max={rangePeriod.max}
                judgement={benchmarkJudgement(
                  areaObservation,
                  benchmarkValue,
                  indicator,
                  confidence,
                )}
                label={`${areaName} ${formatCalculatedValue(areaValue)} against ${benchmarkName} ${formatCalculatedValue(benchmarkValue)}, range ${formatCalculatedValue(rangePeriod.min)} to ${formatCalculatedValue(rangePeriod.max)}`}
              />
            ) : (
              '-'
            )}
          </td>
        </>
      ) : null}
    </>
  );
}

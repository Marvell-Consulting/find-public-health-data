import { stringify } from 'csv-stringify/sync';

import type { comparisonTable } from './comparison.ts';
import { type ConfidenceLevel, periodLabel, segmentLabel } from './data.ts';
import type { IndicatorAreaData, IndicatorDetail } from './loader.ts';
import type { trendTableModel } from './trend.ts';

/** The trend table as displayed, including its selected intervals and benchmarks. */
export function trendCsv(
  indicator: IndicatorDetail,
  model: ReturnType<typeof trendTableModel>,
  confidence: ConfidenceLevel,
  showRange: boolean,
): string {
  const {
    benchmarks,
    hasCounts,
    inPeriod,
    lowerOf,
    periods,
    referenceSegment,
    seriesByArea,
    upperOf,
  } = model;
  const headers = [
    'Period',
    ...seriesByArea.flatMap(({ data }) => {
      const benchmark = benchmarks.get(data.areaCode);
      return [
        ...(hasCounts ? [`${data.areaName} count`] : []),
        `${data.areaName} calculated value (${indicator.unit.label})`,
        ...(confidence === 'none'
          ? []
          : [
              `${data.areaName} lower ${confidence}% CI`,
              `${data.areaName} upper ${confidence}% CI`,
            ]),
        ...(benchmark
          ? [
              `${data.areaName} ${benchmark.name} calculated value (${indicator.unit.label})`,
              ...(showRange
                ? [
                    `${data.areaName} ${benchmark.name} minimum`,
                    `${data.areaName} ${benchmark.name} maximum`,
                  ]
                : []),
            ]
          : []),
      ];
    }),
  ];
  const rows = periods.map((period) => [
    periodLabel(period, indicator.yearType),
    ...seriesByArea.flatMap(({ data, series }) => {
      const observation = series.find(inPeriod(period));
      const benchmark = benchmarks.get(data.areaCode);
      const benchmarkObservation = benchmark?.series.find(inPeriod(period));
      const range = benchmark?.rangePeriods.find(
        (candidate) => inPeriod(period)(candidate) && candidate.segment === referenceSegment,
      );
      return [
        ...(hasCounts ? [observation?.count ?? null] : []),
        observation?.value ?? null,
        ...(confidence === 'none'
          ? []
          : [observation ? lowerOf(observation) : null, observation ? upperOf(observation) : null]),
        ...(benchmark
          ? [
              benchmarkObservation?.value ?? null,
              ...(showRange ? [range?.min ?? null, range?.max ?? null] : []),
            ]
          : []),
      ];
    }),
  ]);
  return stringify([headers, ...rows]);
}

/** Every observation for the selected areas, segments and notes included. */
export function allDataCsv(indicator: IndicatorDetail, areaData: IndicatorAreaData[]): string {
  const rows: (string | number | null)[][] = [
    [
      'Indicator',
      'Area',
      'Period',
      'Segment',
      'Count',
      'Denominator',
      `Calculated value (${indicator.unit.label})`,
      'Lower 95% CI',
      'Upper 95% CI',
      'Lower 99.8% CI',
      'Upper 99.8% CI',
      'Value notes',
    ],
  ];
  for (const data of areaData) {
    for (const observation of data.observations) {
      rows.push([
        indicator.name,
        data.areaName,
        periodLabel(observation, indicator.yearType),
        segmentLabel(observation),
        observation.count,
        observation.denominator,
        observation.value,
        observation.lowerCi95,
        observation.upperCi95,
        observation.lowerCi998,
        observation.upperCi998,
        observation.notes.map(({ text }) => text).join('; ') || null,
      ]);
    }
  }
  return stringify(rows);
}

export function comparisonCsv(
  comparison: ReturnType<typeof comparisonTable>,
  range: boolean,
): string {
  const { areas, rows, trendOf, benchmarkNameFor, benchmarkCellFor } = comparison;
  return stringify([
    [
      'Indicator',
      'Most recent period',
      ...areas.flatMap(({ areaCode, areaName }) => [
        `${areaName} recent trend`,
        `${areaName} count`,
        `${areaName} calculated value`,
        ...(benchmarkNameFor(areaCode)
          ? [
              `${areaName} ${benchmarkNameFor(areaCode)} calculated value`,
              ...(range
                ? [
                    `${areaName} ${benchmarkNameFor(areaCode)} minimum`,
                    `${areaName} ${benchmarkNameFor(areaCode)} maximum`,
                  ]
                : []),
            ]
          : []),
      ]),
    ],
    ...rows.map((row) => [
      `${row.name}${row.suffix ? ` ${row.suffix}` : ''}`,
      row.period,
      ...row.cells.flatMap((cell) => {
        const benchmarkCell = benchmarkNameFor(cell.areaCode)
          ? benchmarkCellFor(row, cell)
          : undefined;
        return [
          trendOf(row, cell).label,
          cell.count === null ? '' : String(cell.count),
          cell.value === null ? '' : `${cell.value} ${row.unit}`,
          ...(benchmarkNameFor(cell.areaCode)
            ? [
                benchmarkCell?.value == null ? '' : `${benchmarkCell.value} ${row.unit}`,
                ...(range
                  ? [
                      benchmarkCell?.rangePeriod ? String(benchmarkCell.rangePeriod.min) : '',
                      benchmarkCell?.rangePeriod ? String(benchmarkCell.rangePeriod.max) : '',
                    ]
                  : []),
              ]
            : []),
        ];
      }),
    ]),
  ]);
}

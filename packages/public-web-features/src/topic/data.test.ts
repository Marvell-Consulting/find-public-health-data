import { describe, expect, it } from 'vitest';
import { comparisonTable } from '../indicator/comparison.ts';
import type { ComparisonRow } from '../indicator/data.ts';
import { benchmarkJudgement } from '../indicator/data.ts';
import type { IndicatorObservation, SelectedIndicator } from '../indicator/loader.ts';
import type { IndicatorSearchRow } from '../search/loader.ts';
import { englandObservation, topicIndicators, topicTableSelection } from './data.ts';

const indicators = Array.from(
  { length: 12 },
  (_, index) =>
    ({
      shortId: index + 1,
      name: `Indicator ${String(index + 1).padStart(2, '0')}`,
      slug: `indicator-${index + 1}`,
      topics: [],
      classifications: [],
    }) satisfies IndicatorSearchRow,
);

describe('topicIndicators', () => {
  it('sorts the complete result set without hiding indicators behind paging', () => {
    const result = topicIndicators(indicators, new URLSearchParams('sort=name-desc&page=2'));
    expect(result.indicators.map(({ shortId }) => shortId)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
  });

  it.each(['-1', '1.5', 'invalid'])('falls back to the first page for %s', (page) => {
    expect(topicIndicators(indicators, new URLSearchParams({ page })).page).toBe(1);
  });

  it('ignores legacy page parameters and retains the complete topic list', () => {
    expect(
      topicIndicators(indicators, new URLSearchParams('page=999')).indicators.map(
        ({ shortId }) => shortId,
      ),
    ).toEqual(indicators.map(({ shortId }) => shortId));
  });
});

function observation(year: number, value: number | null): IndicatorObservation {
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
    value,
    dimensions: [],
    notes: [],
    count: null,
    denominator: null,
    lowerCi95: null,
    upperCi95: null,
    lowerCi998: null,
    upperCi998: null,
  };
}

it('uses England for the area row period rather than a newer England observation', () => {
  const entry = {
    areaData: [
      {
        areaCode: 'E92000001',
        areaName: 'England',
        observations: [observation(2023, 10), observation(2024, 20)],
      },
    ],
  } as SelectedIndicator;
  const row: Pick<ComparisonRow, 'sex' | 'periodType' | 'series'> = {
    sex: '',
    periodType: 'all',
    series: [observation(2023, 8)],
  };
  expect(englandObservation(entry, row)?.value).toBe(10);
  expect(englandObservation(entry, { ...row, series: [observation(2022, 8)] })).toBeUndefined();
});

it('retains the displayed values, valid trend points and older England benchmark when compacting history', () => {
  const entry = {
    detail: {
      shortId: 1,
      name: 'Indicator',
      slug: 'indicator',
      unit: '%',
      yearType: null,
      polarity: 'lower-is-better',
      comparatorMethod: null,
    },
    areaData: [
      {
        areaCode: 'E07000223',
        areaName: 'Adur',
        observations: Array.from({ length: 20 }, (_, index) =>
          observation(2000 + index, index === 18 ? null : index),
        ),
      },
      {
        areaCode: 'E92000001',
        areaName: 'England',
        observations: Array.from({ length: 30 }, (_, index) =>
          observation(2000 + index, index + 10),
        ),
      },
    ],
  } as SelectedIndicator;
  const project = (selected: SelectedIndicator[]) => {
    const model = comparisonTable(selected, { regionByCode: {}, levelByCode: {} }, 'england');
    return model.rows.map((row) => ({
      period: row.period,
      cells: row.cells.map((cell) => {
        const benchmark = model.benchmarkCellFor(row, cell);
        return {
          value: cell.value,
          count: cell.count,
          trend: model.trendOf(row, cell),
          benchmark: benchmark?.value,
          judgement: benchmarkJudgement(
            benchmark?.areaObservation,
            benchmark?.value ?? null,
            entry.detail,
          ),
        };
      }),
    }));
  };
  const compact = topicTableSelection([entry]);
  expect(project(compact)).toEqual(project([entry]));
  expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify([entry]).length / 2);
  expect(
    compact[0]?.areaData[1]?.observations.some(({ fromDate }) => fromDate === '2019-01-01'),
  ).toBe(true);
});

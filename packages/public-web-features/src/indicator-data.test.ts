import { describe, expect, it } from 'vitest';

import {
  barWidth,
  comparisonRows,
  dimensionValues,
  filterObservations,
  formatConfidenceInterval,
  formatValue,
  inequalitySegments,
  latestCoreSegments,
  periodLabel,
  segmentLabel,
  trendSeries,
} from './indicator-data';

function obs(overrides = {}) {
  return {
    fromDate: '2023-01-01',
    toDate: '2023-12-31',
    value: 100,
    lowerCi95: 95,
    upperCi95: 105,
    count: 1000,
    denominator: null,
    dimensions: [],
    ...overrides,
  };
}

function dim(type: string, value: string, overrides = {}) {
  return { type, value, dimensionClass: 'core', sortOrder: 0, ...overrides };
}

describe('periodLabel', () => {
  it('labels a single-year period with the year alone', () => {
    expect(periodLabel(obs())).toBe('2023');
  });

  it('labels a rolling period with its year range', () => {
    expect(periodLabel(obs({ fromDate: '2021-01-01', toDate: '2023-12-31' }))).toBe('2021 to 2023');
  });
});

describe('segmentLabel', () => {
  it('joins dimension values', () => {
    expect(segmentLabel(obs({ dimensions: [dim('Sex', 'Male'), dim('Age', '<75 yrs')] }))).toBe(
      'Male, <75 yrs',
    );
  });

  it('labels the fully-aggregate observation as All', () => {
    expect(segmentLabel(obs())).toBe('All');
  });
});

describe('trendSeries', () => {
  it('returns the least-disaggregated segment in period order', () => {
    const aggregate2022 = obs({
      fromDate: '2022-01-01',
      toDate: '2022-12-31',
      dimensions: [dim('Age', '<75 yrs')],
    });
    const aggregate2023 = obs({ dimensions: [dim('Age', '<75 yrs')] });
    const sexed = obs({ dimensions: [dim('Age', '<75 yrs'), dim('Sex', 'Male')] });

    expect(trendSeries([sexed, aggregate2023, aggregate2022])).toEqual([
      aggregate2022,
      aggregate2023,
    ]);
  });

  it('prefers the longest series among equally-aggregated segments', () => {
    const male2022 = obs({
      fromDate: '2022-01-01',
      toDate: '2022-12-31',
      dimensions: [dim('Sex', 'Male')],
    });
    const male2023 = obs({ dimensions: [dim('Sex', 'Male')] });
    const female2023 = obs({ dimensions: [dim('Sex', 'Female')] });

    expect(trendSeries([female2023, male2023, male2022])).toEqual([male2022, male2023]);
  });

  it('returns empty for no observations', () => {
    expect(trendSeries([])).toEqual([]);
  });
});

describe('latestCoreSegments', () => {
  it('returns only core-dimension segments for the latest, shortest period', () => {
    const oldPeriod = obs({
      fromDate: '2022-01-01',
      toDate: '2022-12-31',
      dimensions: [dim('Sex', 'Male')],
    });
    const rollingPeriod = obs({ fromDate: '2021-01-01', dimensions: [dim('Sex', 'Male')] });
    const latestMale = obs({ dimensions: [dim('Sex', 'Male')] });
    const latestFemale = obs({ dimensions: [dim('Sex', 'Female'), dim('Age', '<75 yrs')] });
    const deprivation = obs({
      dimensions: [dim('Deprivation deciles', 'Most deprived', { dimensionClass: 'inequality' })],
    });

    expect(
      latestCoreSegments([oldPeriod, rollingPeriod, latestMale, latestFemale, deprivation]),
    ).toEqual([latestMale, latestFemale]);
  });
});

describe('formatting', () => {
  it('formats values to one decimal place with grouping', () => {
    expect(formatValue(12345.67)).toBe('12,345.7');
    expect(formatValue(null)).toBe('No data');
  });

  it('formats a confidence interval as a range', () => {
    expect(formatConfidenceInterval(obs())).toBe('95 to 105');
    expect(formatConfidenceInterval(obs({ lowerCi95: null }))).toBe('—');
  });
});

describe('comparisonRows', () => {
  const detail = (fingertipsId: number, name: string) =>
    ({
      fingertipsId,
      name,
      unit: { name: 'per 100,000', label: 'per 100,000' },
    }) as never;

  it('takes each indicator’s latest value in the first selected area', () => {
    const rows = comparisonRows([
      {
        detail: detail(108, 'Mortality'),
        areaData: [
          {
            areaCode: 'E92000001',
            areaName: 'England',
            observations: [
              obs({ fromDate: '2022-01-01', toDate: '2022-12-31', value: 342.2 }),
              obs({ value: 341.1 }),
            ],
          },
        ],
      },
      {
        detail: detail(90366, 'Life expectancy'),
        areaData: [
          { areaCode: 'E92000001', areaName: 'England', observations: [obs({ value: 80.1 })] },
        ],
      },
    ]);

    expect(rows.map((r) => [r.name, r.value, r.period])).toEqual([
      ['Mortality', 341.1, '2023'],
      ['Life expectancy', 80.1, '2023'],
    ]);
    expect(rows[0]?.areaName).toBe('England');
  });

  it('keeps an indicator with no data in the table rather than dropping it', () => {
    const rows = comparisonRows([
      {
        detail: detail(93622, 'No data here'),
        areaData: [{ areaCode: 'E92000001', areaName: 'England', observations: [] }],
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBeNull();
    expect(rows[0]?.period).toBe('');
  });
});

describe('filterObservations', () => {
  const male = obs({ dimensions: [dim('Sex', 'Male')] });
  const female = obs({ dimensions: [dim('Sex', 'Female')] });
  const persons = obs({ dimensions: [] });
  const rolling = obs({ fromDate: '2021-01-01', toDate: '2023-12-31', dimensions: [] });

  it('keeps only the chosen sex, and always the value for all people', () => {
    expect(filterObservations([male, female, persons], { sex: 'Male' })).toEqual([male, persons]);
  });

  it('separates single-year periods from rolling averages', () => {
    expect(filterObservations([persons, rolling], { periodType: '1-year' })).toEqual([persons]);
    expect(filterObservations([persons, rolling], { periodType: '3-year' })).toEqual([rolling]);
    expect(filterObservations([persons, rolling], { periodType: 'all' })).toEqual([
      persons,
      rolling,
    ]);
  });
});

describe('dimensionValues', () => {
  it('lists a dimension’s distinct values in sort order', () => {
    expect(
      dimensionValues(
        [
          obs({ dimensions: [dim('Sex', 'Female', { sortOrder: 2 })] }),
          obs({ dimensions: [dim('Sex', 'Male', { sortOrder: 1 })] }),
          obs({ dimensions: [dim('Sex', 'Male', { sortOrder: 1 })] }),
        ],
        'Sex',
      ),
    ).toEqual(['Male', 'Female']);
  });
});

describe('inequalitySegments', () => {
  it('picks the inequality dimension with the most values in the latest period', () => {
    const deprivation = (name: string) =>
      obs({ dimensions: [dim('Deprivation deciles', name, { dimensionClass: 'inequality' })] });
    const ethnicity = obs({
      dimensions: [dim('Ethnic group', 'White', { dimensionClass: 'inequality' })],
    });
    const core = obs({ dimensions: [dim('Sex', 'Male')] });

    const result = inequalitySegments([
      core,
      ethnicity,
      deprivation('Most deprived'),
      deprivation('Least deprived'),
    ]);

    expect(result.map((o) => o.dimensions[0]?.type)).toEqual([
      'Deprivation deciles',
      'Deprivation deciles',
    ]);
  });

  it('returns nothing when an indicator has no inequality breakdown', () => {
    expect(inequalitySegments([obs({ dimensions: [dim('Sex', 'Male')] })])).toEqual([]);
  });
});

describe('barWidth', () => {
  const row = (value: number | null, unit: string) => ({
    value,
    unit,
    fingertipsId: 1,
    name: '',
    areaName: '',
    period: '',
    segment: '',
    count: null,
  });

  it('scales against the largest value sharing the unit', () => {
    const half = row(50, 'Percent');
    const full = row(100, 'Percent');
    const otherUnit = row(900, 'per 100,000');
    const rows = [half, full, otherUnit];

    expect(barWidth(half, rows)).toBe(50);
    expect(barWidth(full, rows)).toBe(100);
    // The rate is not dwarfed by being on a different scale to the percentages.
    expect(barWidth(otherUnit, rows)).toBe(100);
  });

  it('has no width without a value', () => {
    const missing = row(null, 'Percent');
    expect(barWidth(missing, [missing])).toBe(0);
  });
});

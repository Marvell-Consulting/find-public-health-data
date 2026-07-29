import { describe, expect, it } from 'vitest';

import {
  formatConfidenceInterval,
  formatValue,
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

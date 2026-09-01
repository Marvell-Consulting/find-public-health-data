import { describe, expect, it } from 'vitest';

import {
  alignedTrendSeries,
  availablePeriodTypes,
  comparisonRows,
  confidenceInterval,
  dimensionValues,
  filterObservations,
  formatConfidenceInterval,
  formatValue,
  inequalityBreakdown,
  inequalityCategories,
  inequalityCategoryLabel,
  inequalityCategoryOptions,
  inequalityPeriods,
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
    lowerCi998: 92,
    upperCi998: 108,
    count: 1000,
    denominator: null,
    dimensions: [],
    notes: [],
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

describe('alignedTrendSeries', () => {
  it('follows the reference segment even when its own longest series differs', () => {
    // One area's longest series is Female while the benchmark's is Male — left
    // unaligned, the table would compare different sexes without saying so.
    const reference = obs({ dimensions: [dim('Sex', 'Female')] });
    const male2022 = obs({
      fromDate: '2022-01-01',
      toDate: '2022-12-31',
      dimensions: [dim('Sex', 'Male')],
    });
    const male2023 = obs({ dimensions: [dim('Sex', 'Male')] });
    const female2023 = obs({ dimensions: [dim('Sex', 'Female')] });

    expect(alignedTrendSeries([male2023, female2023, male2022], reference)).toEqual([female2023]);
  });

  it('falls back to its own trend series when the reference segment is not published', () => {
    const reference = obs({ dimensions: [dim('Sex', 'Female')] });
    const male = obs({ dimensions: [dim('Sex', 'Male')] });

    expect(alignedTrendSeries([male], reference)).toEqual([male]);
    expect(alignedTrendSeries([male], undefined)).toEqual([male]);
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
    expect(rows.every((r) => r.suffix === '')).toBe(true);
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

  it('keeps only the chosen sex, so the selection visibly changes the series', () => {
    expect(filterObservations([male, female, persons], { sex: 'Male' })).toEqual([male]);
    expect(filterObservations([male, female, persons], { sex: '' })).toEqual([
      male,
      female,
      persons,
    ]);
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

describe('availablePeriodTypes', () => {
  const single = obs({ dimensions: [] });
  const rolling = obs({ fromDate: '2021-01-01', toDate: '2023-12-31', dimensions: [] });

  it('offers only the period shapes the observations contain', () => {
    expect(availablePeriodTypes([single])).toEqual(['1-year']);
    expect(availablePeriodTypes([rolling])).toEqual(['3-year']);
    expect(availablePeriodTypes([single, rolling])).toEqual(['1-year', '3-year']);
    expect(availablePeriodTypes([])).toEqual([]);
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

describe('confidenceInterval', () => {
  it('reads the interval for the chosen level', () => {
    expect(confidenceInterval(obs(), '95')).toBe('95 to 105');
    expect(confidenceInterval(obs(), '99.8')).toBe('92 to 108');
  });

  it('shows nothing at all when intervals are turned off', () => {
    expect(confidenceInterval(obs(), 'none')).toBe('');
  });

  it('marks an interval the source does not carry', () => {
    expect(confidenceInterval(obs({ lowerCi998: null }), '99.8')).toBe('—');
  });
});

describe('inequality selection', () => {
  const deprivation = (name: string, period = ['2023-01-01', '2023-12-31']) =>
    obs({
      fromDate: period[0],
      toDate: period[1],
      dimensions: [dim('Deprivation deciles', name, { dimensionClass: 'inequality' })],
    });
  const ethnicity = obs({
    dimensions: [dim('Ethnic group', 'White', { dimensionClass: 'inequality' })],
  });
  const all = [
    obs({ dimensions: [dim('Sex', 'Male')] }),
    ethnicity,
    deprivation('Most deprived'),
    deprivation('Least deprived'),
    deprivation('Most deprived', ['2022-01-01', '2022-12-31']),
  ];

  it('offers every inequality category the indicator reports', () => {
    expect(inequalityCategories(all)).toEqual(['Deprivation deciles', 'Ethnic group']);
  });

  it('offers the periods that category reports, oldest first', () => {
    expect(inequalityPeriods(all, 'Deprivation deciles').map((p) => p.label)).toEqual([
      '2022',
      '2023',
    ]);
  });

  it('breaks one category down for one period', () => {
    const rows = inequalityBreakdown(all, 'Deprivation deciles', '2023-01-01/2023-12-31');

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.dimensions[0]?.type === 'Deprivation deciles')).toBe(true);
  });

  it('keeps only the pure category rows, never sexed sub-breakdowns', () => {
    const sexedDecile = obs({
      dimensions: [
        dim('Deprivation deciles', 'Most deprived', { dimensionClass: 'inequality' }),
        dim('Sex', 'Male'),
      ],
    });

    const rows = inequalityBreakdown(
      [...all, sexedDecile],
      'Deprivation deciles',
      '2023-01-01/2023-12-31',
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.dimensions.length === 1)).toBe(true);
  });
});

describe('inequalityCategoryOptions', () => {
  it('shortens Pholio category names the way the prototype labels them', () => {
    expect(
      inequalityCategoryLabel(
        'County & UA deprivation deciles in England (IMD2019, 4/23 geography)',
      ),
    ).toBe('County and unitary authority deprivation deciles (IMD2019)');
    expect(inequalityCategoryLabel('LSOA21 deprivation deciles within area (IMD trend)')).toBe(
      'LSOA21 deprivation deciles (IMD trend)',
    );
  });

  it('keeps the geography qualifier only where shortened labels would collide', () => {
    const options = inequalityCategoryOptions([
      'County & UA deprivation deciles in England (IMD2019, 4/21 geography)',
      'County & UA deprivation deciles in England (IMD2019, 4/23 geography)',
      'District & UA deprivation deciles in England (IMD2025, 4/23 geography)',
    ]);

    expect(options.map(({ label }) => label)).toEqual([
      'County and unitary authority deprivation deciles (IMD2019, 4/21 geography)',
      'County and unitary authority deprivation deciles (IMD2019, 4/23 geography)',
      'District and unitary authority deprivation deciles (IMD2025)',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { periodLabel } from './period-label.ts';
import { publicYearType } from './period-type.ts';

function obs(overrides = {}) {
  return { fromDate: '2023-01-01', toDate: '2023-12-31', ...overrides };
}

describe('periodLabel', () => {
  it('labels a single-year period with the year alone', () => {
    expect(periodLabel(obs())).toBe('2023');
  });

  it('labels a rolling period with its year range', () => {
    expect(periodLabel(obs({ fromDate: '2021-01-01', toDate: '2023-12-31' }))).toBe('2021 to 2023');
  });

  const financial = publicYearType('financial', null);

  it('labels a financial year as one period spanning two years', () => {
    const financialYear = obs({ fromDate: '2022-04-01', toDate: '2023-03-31' });

    expect(periodLabel(financialYear, financial)).toBe('2022/23');
  });

  it('labels a year ending on a specified 31 March as a financial year', () => {
    const yearEnd = publicYearType('specified-end-date', { day: 31, month: 3 });
    const year = obs({ fromDate: '2022-04-01', toDate: '2023-03-31' });

    expect(periodLabel(year, yearEnd)).toBe('2022/23');
  });

  it('knows a financial year by its value, not its label', () => {
    const year = obs({ fromDate: '2022-04-01', toDate: '2023-03-31' });

    expect(periodLabel(year, { value: 'financial', label: 'Renamed' })).toBe('2022/23');
    expect(periodLabel(year, { value: 'rolling', label: 'Financial' })).toBe('2022 to 2023');
  });

  it('labels a Fingertips financial year of cumulative quarters as one financial year', () => {
    const cumulativeQuarters = obs({ fromDate: '2022-04-01', toDate: '2023-03-31' });
    const multiYear = obs({ fromDate: '2020-04-01', toDate: '2023-03-31' });

    expect(periodLabel(cumulativeQuarters, financial)).toBe('2022/23');
    expect(periodLabel(multiYear, financial)).toBe('2020 to 2023');
  });

  it.each([
    ['another year type', publicYearType('specified-end-date', { day: 31, month: 7 })],
    ['an academic year', publicYearType('specified-end-date', { day: 31, month: 8 })],
    ['no year type, as months have', null],
  ])('labels a year spanning two years as a range for %s', (_, yearType) => {
    const year = obs({ fromDate: '2022-08-01', toDate: '2023-07-31' });

    expect(periodLabel(year, yearType)).toBe('2022 to 2023');
  });
});

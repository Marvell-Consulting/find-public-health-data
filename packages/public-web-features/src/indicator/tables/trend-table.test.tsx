// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail } from '../loader.ts';
import { TrendTable } from './trend-table.tsx';

afterEach(cleanup);

function indicator(unit: string | null) {
  return {
    name: 'Resident population',
    unit,
    yearType: 'Calendar',
    polarity: 'no-comparison-possible',
    comparatorMethod: null,
  } as IndicatorDetail;
}

const areaData = [
  {
    areaCode: 'E92000001',
    areaName: 'England',
    observations: [
      {
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        value: 12.3,
        lowerCi95: null,
        upperCi95: null,
        lowerCi998: null,
        upperCi998: null,
        count: null,
        denominator: null,
        notes: [],
        dimensions: [],
      },
    ],
  },
];

describe('TrendTable', () => {
  it.each([
    ['with no unit', null, 'Calculated value', '12.3'],
    ['as a percentage', '%', 'Calculated value (%)', '12.3%'],
    ['per 100,000', 'per 100,000', 'Calculated value (per 100,000)', '12.3'],
  ])('heads and shows values %s', (_, unit, heading, value) => {
    render(<TrendTable areaData={areaData} confidence="none" indicator={indicator(unit)} />);

    const row = screen.getByRole('rowheader', { name: '2023' }).closest('tr');

    expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('cell').textContent).toBe(value);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { trendCsv } from '../download.ts';
import type { IndicatorAreaData, IndicatorDetail } from '../loader.ts';
import { type TrendColumns, trendTableModel } from '../trend.ts';
import { TrendTable } from './trend-table.tsx';

afterEach(cleanup);

function indicator(unit: string | null) {
  return {
    name: 'Resident population',
    unit,
    yearType: { value: 'calendar', label: 'Calendar' },
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
        numerator: null,
        denominator: null,
        notes: [],
        dimensions: [],
      },
    ],
  },
];

describe('TrendTable', () => {
  it('keeps count, numerator, value and both interval column choices consistent with the CSV', () => {
    const columns: TrendColumns = {
      count: true,
      numerator: true,
      value: false,
      confidence: ['95', '99.8'],
    };
    const data = areaData.map((area) => ({
      ...area,
      observations: area.observations.map((row) => ({
        ...row,
        count: 1024,
        numerator: 512,
        lowerCi95: 11,
        upperCi95: 13,
        lowerCi998: 10,
        upperCi998: 14,
      })),
    }));
    render(
      <TrendTable areaData={data} confidence="none" columns={columns} indicator={indicator('%')} />,
    );
    expect(screen.getByRole('columnheader', { name: 'Count' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Numerator' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /Calculated value/ })).toBeNull();
    expect(
      screen.getByRole('columnheader', { name: '95% lower confidence interval' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('columnheader', { name: '99.8% lower confidence interval' }),
    ).toBeTruthy();
    const csv = trendCsv(
      indicator('%'),
      trendTableModel({ areaData: data, confidence: 'none' }),
      'none',
      false,
      columns,
    );
    expect(csv).toContain(
      'England count,England numerator,England lower 95% CI,England upper 95% CI,England lower 99.8% CI,England upper 99.8% CI',
    );
    expect(csv).toContain('2023,1024,512,11,13,10,14');
    expect(csv).not.toContain('calculated value');
  });
  it('shows a numerator column without a picker only when the data has numerators', () => {
    const withNumerators = areaData.map((area) => ({
      ...area,
      observations: area.observations.map((row) => ({ ...row, numerator: 512 })),
    }));
    const { rerender } = render(
      <TrendTable areaData={areaData} confidence="none" indicator={indicator(null)} />,
    );
    expect(screen.queryByRole('columnheader', { name: /^Numerator/ })).toBeNull();

    rerender(
      <TrendTable areaData={withNumerators} confidence="none" indicator={indicator(null)} />,
    );

    expect(screen.getByRole('columnheader', { name: 'Numerator (Raw number)' })).toBeTruthy();
  });
  it('shows no numerator column when an older API sends none', () => {
    const older = areaData.map((area) => ({
      ...area,
      observations: area.observations.map(({ numerator: _, ...row }) => ({ ...row, count: 4 })),
    }));
    render(
      <TrendTable
        areaData={older as unknown as IndicatorAreaData[]}
        confidence="none"
        indicator={indicator(null)}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Count (Raw number)' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /^Numerator/ })).toBeNull();
  });

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

it('uses the visible caption as the table accessible name', () => {
  render(
    <TrendTable visibleCaption areaData={areaData} confidence="none" indicator={indicator('%')} />,
  );
  const table = screen.getByRole('table', { name: 'Table: Resident population, England, All' });
  expect(table.hasAttribute('aria-label')).toBe(false);
});

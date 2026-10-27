// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail } from '../loader.ts';
import { InequalitiesTable } from './inequalities-table.tsx';

afterEach(cleanup);

function indicator(unit: string | null) {
  return { unit, yearType: { value: 'calendar', label: 'Calendar' } } as IndicatorDetail;
}

const observations = [
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
    dimensions: [{ type: 'Sex', value: 'Female', dimensionClass: 'inequality', sortOrder: 0 }],
  },
];

describe('InequalitiesTable', () => {
  it.each([
    ['with no unit', null, 'Value'],
    ['per 100,000', 'per 100,000', 'Value (per 100,000)'],
  ])('heads values %s', (_, unit, heading) => {
    render(
      <InequalitiesTable
        confidence="none"
        indicator={indicator(unit)}
        observations={observations}
      />,
    );

    const row = screen.getByRole('rowheader', { name: 'Female' }).closest('tr');

    expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy();
    expect(within(row as HTMLElement).getByRole('cell').textContent).toBe('12.3');
  });

  it("compares with England under the raw number the indicator has, a rate's numerator", () => {
    render(
      <InequalitiesTable
        benchmark={10}
        benchmarkMeasures={{ count: null, numerator: 900 }}
        confidence="none"
        indicator={indicator(null)}
        observations={observations.map((observation) => ({ ...observation, numerator: 41 }))}
      />,
    );

    const headers = screen.getAllByRole('columnheader').map(({ textContent }) => textContent);
    const female = screen.getByRole('rowheader', { name: 'Female' }).closest('tr');
    const england = screen.getByRole('rowheader', { name: 'England' }).closest('tr');

    expect(headers).toContain('Numerator');
    expect(headers).not.toContain('Count');
    expect(within(female as HTMLElement).getAllByRole('cell')[0]?.textContent).toBe('41');
    expect(within(england as HTMLElement).getAllByRole('cell')[0]?.textContent).toBe('900');
  });
});

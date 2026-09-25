// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail } from '../loader.ts';
import { InequalitiesTable } from './inequalities-table.tsx';

afterEach(cleanup);

function indicator(unit: string | null) {
  return { unit, yearType: 'Calendar' } as IndicatorDetail;
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
});

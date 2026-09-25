// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail, SelectedIndicator } from '../loader.ts';
import { ComparisonSection } from './comparison-section.tsx';

afterEach(cleanup);

function selected(shortId: number, name: string, unit: string | null): SelectedIndicator {
  return {
    detail: {
      shortId,
      name,
      unit,
      yearType: 'Calendar',
      polarity: 'no-comparison-possible',
    } as IndicatorDetail,
    areaData: [
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
    ],
  };
}

function calculatedValueIn(name: string) {
  const row = screen.getByRole('cell', { name }).closest('tr');
  return within(row as HTMLElement)
    .getAllByRole('cell')
    .at(-1)?.textContent;
}

describe('ComparisonSection', () => {
  it('shows a value with no unit bare beside one with its unit', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <ComparisonSection
            selected={[
              selected(92708, 'Resident population', null),
              selected(108, 'Mortality', 'per 100,000'),
            ]}
          />
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('columnheader', { name: 'Calculated value' })).toBeTruthy();
    expect(calculatedValueIn('Resident population')).toBe('12.3');
    expect(calculatedValueIn('Mortality')).toBe('12.3 per 100,000');
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it } from 'vitest';

import { SearchFilterPane } from './filter-pane.js';
import { EMPTY_SEARCH_STATE } from './url.js';

afterEach(cleanup);

it('uses dimension and slug together for classification labels', () => {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <SearchFilterPane
          state={{ ...EMPTY_SEARCH_STATE, indicatorTypes: ['shared'], riskFactors: ['shared'] }}
          facets={{
            topics: [],
            classifications: [
              { dimension: 'indicator_type', slug: 'shared', name: 'Indicator type label' },
              { dimension: 'risk_factor', slug: 'shared', name: 'Risk factor label' },
            ],
            sources: [],
            valueTypes: [],
            yearTypes: [],
          }}
          displayGroups={[]}
          gaAreaNames={{}}
        />
      ),
    },
  ]);
  render(<RouterProvider router={router} />);

  expect(screen.getByText('Indicator type label')).toBeTruthy();
  expect(screen.getByText('Risk factor label')).toBeTruthy();
});

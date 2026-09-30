// @vitest-environment jsdom
import { YEAR_TYPES } from '@fphd/utils/period-type';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail } from './loader.ts';
import { BackgroundInformation } from './metadata.tsx';

afterEach(cleanup);

const indicator: IndicatorDetail = {
  shortId: 108,
  slug: 'an-indicator',
  name: 'An indicator',
  valueType: 'Proportion',
  unit: { name: '%', label: '%' },
  yearType: { id: YEAR_TYPES.calendar.id, label: 'Calendar' },
  updateFrequency: 'annually',
  polarity: 'lower-is-better',
  ciMethod: null,
  ciConfidenceLevel: null,
  comparatorMethod: null,
  dataUpdatedAt: null,
  definition: null,
  rationale: null,
  methodology: null,
  numeratorDefinition: 'Deaths',
  denominatorDefinition: null,
  disclosureControl: null,
  caveats: null,
  notes: null,
  dataSource: null,
  numeratorSources: [
    { provider: 'Office for National Statistics (ONS)', source: 'Annual mortality extract' },
    { provider: 'NHS England (NHSE)', source: null },
  ],
  denominatorSources: [],
  areaTypes: [],
  topics: [],
  classifications: [],
};

function renderBackground(detail: IndicatorDetail) {
  render(
    <MemoryRouter>
      <BackgroundInformation indicator={detail} />
    </MemoryRouter>,
  );
}

describe('BackgroundInformation', () => {
  it('lists each numerator source, naming a provider alone where it has no specific source', () => {
    renderBackground(indicator);

    const sources = within(screen.getByRole('list')).getAllByRole('listitem');

    expect(sources.map((item) => item.textContent)).toEqual([
      'Office for National Statistics (ONS): Annual mortality extract',
      'NHS England (NHSE)',
    ]);
  });

  it('leaves out a part with neither sources nor a definition', () => {
    renderBackground(indicator);

    expect(screen.getByRole('heading', { name: 'Numerator' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Denominator' })).toBeNull();
  });

  it('shows the year type', () => {
    renderBackground(indicator);

    expect(screen.getByText('Year type')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
  });

  it('leaves out the year type row for an indicator of months, which has none', () => {
    renderBackground({ ...indicator, yearType: null });

    expect(screen.queryByText('Year type')).toBeNull();
    expect(screen.getByText('Value type')).toBeTruthy();
  });
});

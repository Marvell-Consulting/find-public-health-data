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
  unit: '%',
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

function attributeNames() {
  return screen.getAllByRole('term').map((term) => term.textContent);
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

  it('lists the value type and unit among the data attributes', () => {
    renderBackground(indicator);

    expect(attributeNames()).toEqual(expect.arrayContaining(['Value type', 'Unit']));
    expect(screen.getByText('%')).toBeTruthy();
  });

  it('lists no unit for values that have none', () => {
    renderBackground({ ...indicator, unit: null });

    expect(attributeNames()).toContain('Value type');
    expect(attributeNames()).not.toContain('Unit');
  });

  it('lists the year type', () => {
    renderBackground(indicator);

    expect(attributeNames()).toContain('Year type');
    expect(screen.getByText('Calendar')).toBeTruthy();
  });

  it('lists no year type for an indicator of months, which has none', () => {
    renderBackground({ ...indicator, yearType: null });

    expect(attributeNames()).toContain('Value type');
    expect(attributeNames()).not.toContain('Year type');
  });
});

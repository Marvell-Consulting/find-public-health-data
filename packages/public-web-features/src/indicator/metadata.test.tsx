// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail } from './loader.ts';
import { BackgroundInformation } from './metadata.tsx';

afterEach(cleanup);

const indicator: IndicatorDetail = {
  shortId: 92708,
  slug: 'resident-population',
  name: 'Resident population',
  valueType: 'Count',
  unit: 'per 100,000',
  yearType: 'Calendar',
  updateFrequency: 'annually',
  polarity: 'no-comparison-possible',
  ciMethod: null,
  ciConfidenceLevel: null,
  comparatorMethod: null,
  dataUpdatedAt: null,
  definition: null,
  rationale: null,
  methodology: null,
  numeratorDefinition: null,
  denominatorDefinition: null,
  disclosureControl: null,
  caveats: null,
  notes: null,
  dataSource: null,
  numeratorSource: null,
  denominatorSource: null,
  areaTypes: [],
  topics: [],
  classifications: [],
};

function attributeNames() {
  return screen.getAllByRole('term').map((term) => term.textContent);
}

describe('BackgroundInformation', () => {
  it('lists the value type and unit among the data attributes', () => {
    render(<BackgroundInformation indicator={indicator} />);

    expect(attributeNames()).toEqual(expect.arrayContaining(['Value type', 'Unit']));
    expect(screen.getByText('per 100,000')).toBeTruthy();
  });

  it('lists no unit for values that have none', () => {
    render(<BackgroundInformation indicator={{ ...indicator, unit: null }} />);

    expect(attributeNames()).toContain('Value type');
    expect(attributeNames()).not.toContain('Unit');
  });

  it('lists the year type', () => {
    render(<BackgroundInformation indicator={indicator} />);

    expect(attributeNames()).toContain('Year type');
    expect(screen.getByText('Calendar')).toBeTruthy();
  });

  it('lists no year type for an indicator of months, which has none', () => {
    render(<BackgroundInformation indicator={{ ...indicator, yearType: null }} />);

    expect(attributeNames()).toContain('Value type');
    expect(attributeNames()).not.toContain('Year type');
  });
});

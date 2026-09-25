// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { IndicatorDetail } from './loader.ts';
import { BackgroundInformation } from './metadata.tsx';

afterEach(cleanup);

function indicator(overrides: Partial<IndicatorDetail> = {}): IndicatorDetail {
  return {
    shortId: 108,
    slug: 'an-indicator',
    name: 'An indicator',
    valueType: 'Crude rate',
    unit: { name: 'per 100,000', label: 'per 100,000' },
    yearType: 'Calendar',
    updateFrequency: 'annually',
    polarity: 'lower-is-better',
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
    ...overrides,
  };
}

describe('BackgroundInformation', () => {
  it('shows the year type', () => {
    render(<BackgroundInformation indicator={indicator()} />);

    expect(screen.getByText('Year type')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
  });

  it('leaves out the year type row for an indicator of months, which has none', () => {
    render(<BackgroundInformation indicator={indicator({ yearType: null })} />);

    expect(screen.queryByText('Year type')).toBeNull();
    expect(screen.getByText('Value type')).toBeTruthy();
  });
});

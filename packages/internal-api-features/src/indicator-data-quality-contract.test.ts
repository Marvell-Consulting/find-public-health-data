import { describe, expect, it } from 'vitest';

import { dataQualitySection as section } from './indicator-data-quality-contract.ts';
import { sectionFieldErrors } from './testing.ts';

describe('dataQualitySection', () => {
  it.each(['yes', 'no'])('takes %s', (hasDataQualityIssues) => {
    expect(section.schema.parse({ hasDataQualityIssues })).toEqual({ hasDataQualityIssues });
  });

  it.each([
    { hasDataQualityIssues: '' },
    {},
    { hasDataQualityIssues: 'maybe' },
    { hasDataQualityIssues: 'Yes' },
    { hasDataQualityIssues: true },
  ])('asks whether there are data quality issues given %o', (body) => {
    expect(sectionFieldErrors(section, body)).toEqual({
      hasDataQualityIssues: 'Select whether there are any data quality issues with this indicator',
    });
  });
});

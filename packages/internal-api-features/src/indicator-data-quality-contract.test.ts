import { describe, expect, it } from 'vitest';

import { dataQualitySection as section } from './indicator-data-quality-contract.ts';
import { sectionFieldErrors } from './testing.ts';

describe('dataQualitySection', () => {
  it.each(['yes', 'no'])('takes %s', (dataQualityIssues) => {
    expect(section.schema.parse({ dataQualityIssues })).toEqual({ dataQualityIssues });
  });

  it.each([
    { dataQualityIssues: '' },
    {},
    { dataQualityIssues: 'maybe' },
    { dataQualityIssues: 'Yes' },
    { dataQualityIssues: true },
  ])('asks whether there are data quality issues given %o', (body) => {
    expect(sectionFieldErrors(section, body)).toEqual({
      dataQualityIssues: 'Select whether there are any data quality issues with this indicator',
    });
  });
});

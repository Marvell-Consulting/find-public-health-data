import { describe, expect, it } from 'vitest';

import { definitionAndRationaleSection as section } from './indicator-definition-and-rationale-contract.ts';
import { sectionFieldErrors } from './testing.ts';

describe('definitionAndRationaleSection', () => {
  it('takes both answers without their surrounding spaces', () => {
    expect(
      section.schema.parse({ definition: '  A definition\n', rationale: '\tA rationale  ' }),
    ).toEqual({ definition: 'A definition', rationale: 'A rationale' });
  });

  it.each([
    [
      { definition: '', rationale: '' },
      {
        definition: 'Enter the definition of the indicator',
        rationale: 'Enter the rationale for the indicator',
      },
    ],
    [
      { definition: '   ', rationale: 'A rationale' },
      { definition: 'Enter the definition of the indicator' },
    ],
    [
      { definition: 'A definition', rationale: '\n\t' },
      { rationale: 'Enter the rationale for the indicator' },
    ],
  ])('refuses %o', (body, fieldErrors) => {
    expect(sectionFieldErrors(section, body)).toEqual(fieldErrors);
  });

  it.each([{}, { definition: 'A definition' }, { definition: 1, rationale: 2 }])(
    'refuses %o, which the form never sends',
    (body) => {
      expect(sectionFieldErrors(section, body)).toBeDefined();
    },
  );

  it('accepts long answers, setting no length limit of its own', () => {
    const long = 'a'.repeat(20_000);

    expect(sectionFieldErrors(section, { definition: long, rationale: long })).toBeUndefined();
  });
});

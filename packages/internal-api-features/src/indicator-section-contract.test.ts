import { describe, expect, it } from 'vitest';

import { definitionAndRationaleSection as section } from './indicator-definition-and-rationale-contract.ts';
import {
  indicatorSectionFormValues,
  isIndicatorSectionComplete,
} from './indicator-section-contract.ts';

describe('indicatorSectionFormValues', () => {
  it('gives an unanswered field as empty text', () => {
    expect(
      indicatorSectionFormValues(section.fields, { definition: 'A definition', rationale: null }),
    ).toEqual({ definition: 'A definition', rationale: '' });
  });
});

describe('isIndicatorSectionComplete', () => {
  it.each([
    [{ definition: 'A definition', rationale: 'A rationale' }, true],
    [{ definition: 'A definition', rationale: null }, false],
    [{ definition: 'A definition', rationale: '  ' }, false],
  ])('judges %o complete: %s', (answers, complete) => {
    expect(isIndicatorSectionComplete(section, answers)).toBe(complete);
  });
});

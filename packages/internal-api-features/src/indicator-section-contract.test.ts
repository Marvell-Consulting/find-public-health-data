import { z } from '@fphd/config/zod';
import { describe, expect, it } from 'vitest';

import { definitionAndRationaleSection as section } from './indicator-definition-and-rationale-contract.ts';
import {
  indicatorSectionFormValues,
  isIndicatorSectionComplete,
  requireDetails,
  yesNoSchema,
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

describe('requireDetails', () => {
  const schema = requireDetails(
    z.object({
      answer: yesNoSchema('Select an answer'),
      detail: z.string().trim(),
      other: z.string().min(1, 'Enter the other'),
    }),
    [{ answer: 'answer', detail: 'detail', detailRequired: 'Enter the detail' }],
  );

  function issues(body: object) {
    return schema.safeParse(body).error?.issues.map(({ path, message }) => [path, message]);
  }

  it.each(['no', 'yes'])('accepts details beside %s', (answer) => {
    expect(issues({ answer, detail: 'A detail', other: 'x' })).toBeUndefined();
  });

  it('accepts no details beside a no', () => {
    expect(issues({ answer: 'no', detail: '', other: 'x' })).toBeUndefined();
  });

  it('refuses a yes with blank details', () => {
    expect(issues({ answer: 'yes', detail: '  ', other: 'x' })).toEqual([
      [['detail'], 'Enter the detail'],
    ]);
  });

  it('refuses the details beside the other refusals', () => {
    expect(issues({ answer: 'yes', detail: '', other: '' })).toEqual([
      [['other'], 'Enter the other'],
      [['detail'], 'Enter the detail'],
    ]);
  });
});

describe('yesNoSchema', () => {
  it.each(['yes', 'no'])('accepts %s', (answer) => {
    expect(yesNoSchema('Select an answer').parse(answer)).toBe(answer);
  });

  it.each(['', 'not-applicable', true])('refuses %o with its message', (answer) => {
    expect(yesNoSchema('Select an answer').safeParse(answer).error?.issues[0]?.message).toBe(
      'Select an answer',
    );
  });
});

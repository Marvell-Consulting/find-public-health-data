import { describe, expect, it } from 'vitest';

import {
  type ConfidenceIntervals,
  missingCiMethodFollowUps,
  confidenceIntervalsSection as section,
} from './indicator-confidence-intervals-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const methodId = '019fa38f-073f-764e-9ac6-1c4d03b1cb92';

const unanswered: ConfidenceIntervals = {
  ciMethodId: methodId,
  ciMethodModified: '',
  ciMethodModifications: '',
  ciMethodOtherDetail: '',
};

describe('confidenceIntervalsSection', () => {
  it('takes every answer without its surrounding spaces, leaving the follow-ups to the method', () => {
    expect(
      section.schema.parse({
        ciMethodId: methodId,
        ciMethodModified: 'yes',
        ciMethodModifications: '  Adjusted for clustering  ',
        ciMethodOtherDetail: '  Bootstrap intervals\n',
      }),
    ).toEqual({
      ciMethodId: methodId,
      ciMethodModified: 'yes',
      ciMethodModifications: 'Adjusted for clustering',
      ciMethodOtherDetail: 'Bootstrap intervals',
    });
  });

  it('asks for a method when none is chosen', () => {
    expect(sectionFieldErrors(section, { ...unanswered, ciMethodId: '' })).toEqual({
      ciMethodId: 'Select the confidence interval method used',
    });
  });

  it.each([
    {},
    { ...unanswered, ciMethodId: 'byars' },
    { ...unanswered, ciMethodModified: 'maybe' },
    { ...unanswered, ciMethodOtherDetail: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

describe('missingCiMethodFollowUps', () => {
  it.each([
    [
      'a standard method with no answer on modifications',
      'standard',
      {},
      {
        ciMethodModified: 'Select whether any modifications were used',
      },
    ],
    ['an unmodified standard method', 'standard', { ciMethodModified: 'no' }, {}],
    [
      'a modified standard method with no description of the modifications',
      'standard',
      { ciMethodModified: 'yes' },
      { ciMethodModifications: 'Enter a description of the modifications used' },
    ],
    [
      'a modified standard method described',
      'standard',
      { ciMethodModified: 'yes', ciMethodModifications: 'Adjusted' },
      {},
    ],
    [
      'an other method with no detail',
      'other',
      {},
      {
        ciMethodOtherDetail: 'Enter details of the other confidence interval method used',
      },
    ],
    ['an other method detailed', 'other', { ciMethodOtherDetail: 'Bootstrap' }, {}],
    ['a method with nothing to describe', 'none', {}, {}],
  ] as const)('asks of %s', (_, kind, answers, missing) => {
    expect(missingCiMethodFollowUps({ ...unanswered, ...answers }, kind)).toEqual(missing);
  });
});

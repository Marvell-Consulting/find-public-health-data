import { describe, expect, it } from 'vitest';

import { otherCommentsSection as section } from './indicator-other-comments-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const answered = {
  sponsorsAndStakeholders: 'The national screening committee.',
  hasReviewerComments: 'no',
  reviewerCommentsDetail: '',
};

describe('otherCommentsSection', () => {
  it('takes every answer without its surrounding spaces', () => {
    expect(
      section.schema.parse({
        sponsorsAndStakeholders: ' The committee.\n',
        hasReviewerComments: 'yes',
        reviewerCommentsDetail: '\tReplaces 108. ',
      }),
    ).toEqual({
      sponsorsAndStakeholders: 'The committee.',
      hasReviewerComments: 'yes',
      reviewerCommentsDetail: 'Replaces 108.',
    });
  });

  it('asks for no comments when there are none', () => {
    expect(sectionFieldErrors(section, answered)).toBeUndefined();
  });

  it('asks only whether there are comments when the form is empty', () => {
    expect(
      sectionFieldErrors(section, {
        sponsorsAndStakeholders: '',
        hasReviewerComments: '',
        reviewerCommentsDetail: '',
      }),
    ).toEqual({ hasReviewerComments: 'Select whether you have additional comments' });
  });

  it('takes blank sponsors and stakeholders as none', () => {
    expect(
      section.schema.parse({ ...answered, sponsorsAndStakeholders: ' \n' }).sponsorsAndStakeholders,
    ).toBe('');
  });

  it('asks for the comments of a yes, blank ones included', () => {
    expect(
      sectionFieldErrors(section, {
        ...answered,
        hasReviewerComments: 'yes',
        reviewerCommentsDetail: ' \n',
      }),
    ).toEqual({ reviewerCommentsDetail: 'Enter your comments' });
  });

  it.each([
    null,
    {},
    { ...answered, hasReviewerComments: 'not-applicable' },
    { ...answered, sponsorsAndStakeholders: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';

import { removeIntent } from '../list-form.ts';
import {
  type ReviewerAssignmentValues,
  readReviewerAssignmentForm,
  withChosenReviewerTakenIn,
  withReviewerAdded,
  withReviewerRemoved,
} from './form.ts';

const morgan = '019fa38f-073f-764e-9ac6-1c4d03b20001';
const jamie = '019fa38f-073f-764e-9ac6-1c4d03b20002';

const values: ReviewerAssignmentValues = {
  submissionNumber: 2,
  previousReviewerIds: [morgan],
  reviewerIds: [morgan],
  addReviewer: '',
};

function formData(fields: [string, string][]) {
  const data = new FormData();
  for (const [name, value] of fields) data.append(name, value);
  return data;
}

function refusalOf(read: () => unknown): unknown {
  try {
    read();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('readReviewerAssignmentForm', () => {
  it('reads the submission, both lists of reviewers in order and the choice', () => {
    expect(
      readReviewerAssignmentForm(
        formData([
          ['submissionNumber', '2'],
          ['previousReviewerIds', morgan],
          ['reviewerIds', jamie],
          ['reviewerIds', morgan],
          ['addReviewer', ''],
        ]),
      ).values,
    ).toEqual({
      submissionNumber: 2,
      previousReviewerIds: [morgan],
      reviewerIds: [jamie, morgan],
      addReviewer: '',
    });
  });

  it('reads which button sent the form', () => {
    expect(
      readReviewerAssignmentForm(
        formData([
          ['submissionNumber', '1'],
          ['intent', removeIntent(0)],
        ]),
      ).intent,
    ).toEqual({ to: 'remove', index: 0 });
  });

  it.each([
    ['no submission number', [['reviewerIds', morgan]]],
    [
      'a reviewer id the page would not have written',
      [
        ['submissionNumber', '1'],
        ['reviewerIds', 'not-an-id'],
      ],
    ],
    [
      'a reviewer listed twice',
      [
        ['submissionNumber', '1'],
        ['reviewerIds', morgan],
        ['reviewerIds', morgan],
      ],
    ],
    [
      'a choice the select did not offer',
      [
        ['submissionNumber', '1'],
        ['addReviewer', 'not-an-id'],
      ],
    ],
  ] as [string, [string, string][]][])('refuses a form with %s', (_, fields) => {
    expect((refusalOf(() => readReviewerAssignmentForm(formData(fields))) as Response).status).toBe(
      400,
    );
  });
});

describe('withReviewerAdded', () => {
  it('lists the chosen reviewer and clears the select', () => {
    expect(withReviewerAdded({ ...values, addReviewer: jamie })).toEqual({
      values: { ...values, reviewerIds: [morgan, jamie] },
      fieldErrors: {},
    });
  });

  it('lists a reviewer already listed only once', () => {
    expect(withReviewerAdded({ ...values, addReviewer: morgan }).values.reviewerIds).toEqual([
      morgan,
    ]);
  });

  it('asks for a reviewer when none is chosen', () => {
    expect(withReviewerAdded(values)).toEqual({
      values,
      fieldErrors: { addReviewer: 'Select a reviewer' },
    });
  });
});

describe('withReviewerRemoved', () => {
  it('takes the reviewer at the index off the list, keeping the choice', () => {
    expect(
      withReviewerRemoved({ ...values, reviewerIds: [morgan, jamie], addReviewer: jamie }, 0),
    ).toEqual({ values: { ...values, reviewerIds: [jamie], addReviewer: jamie }, fieldErrors: {} });
  });
});

describe('withChosenReviewerTakenIn', () => {
  it('saves the listed reviewers', () => {
    expect(withChosenReviewerTakenIn(values)).toEqual({ values, fieldErrors: {} });
  });

  it('takes in a reviewer chosen but not added', () => {
    expect(withChosenReviewerTakenIn({ ...values, addReviewer: jamie }).values.reviewerIds).toEqual(
      [morgan, jamie],
    );
  });

  it('asks for a reviewer when none is listed or chosen', () => {
    expect(withChosenReviewerTakenIn({ ...values, reviewerIds: [] }).fieldErrors).toEqual({
      addReviewer: 'Select a reviewer',
    });
  });
});

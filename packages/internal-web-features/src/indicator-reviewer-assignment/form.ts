import {
  draftReviewerSchema,
  indicatorAssignReviewersSchema,
} from '@fphd/internal-api-features/contract';

import type { FormFailure } from '../indicator-section.ts';
import { type ListIntent, readListIntent } from '../list-form.ts';

export const SELECT_A_REVIEWER = 'Select a reviewer';

/**
 * The reviewers listed so far and the one chosen in the select, with the submission and the
 * reviewers the page first showed, which travel unchanged so the save names what was seen.
 */
export interface ReviewerAssignmentValues {
  submissionNumber: number;
  previousReviewerIds: string[];
  reviewerIds: string[];
  addReviewer: string;
}

export type ReviewerAssignmentField = 'addReviewer';

/** The page as the action re-renders it: after a refusal, or with a reviewer added or removed. */
export type ReviewerAssignmentState = FormFailure<
  ReviewerAssignmentField,
  ReviewerAssignmentValues
>;

/**
 * The form as sent, and which of its buttons sent it. The page writes only values it was given,
 * so one that fails the contract was not sent by it, and the request is refused whole.
 */
export function readReviewerAssignmentForm(formData: FormData): {
  values: ReviewerAssignmentValues;
  intent: ListIntent;
} {
  const ids = (name: string) => formData.getAll(name).filter((id) => typeof id === 'string');
  const chosen = formData.get('addReviewer');
  const addReviewer = typeof chosen === 'string' ? chosen : '';
  const sent = indicatorAssignReviewersSchema.safeParse({
    submissionNumber: Number(formData.get('submissionNumber')),
    previousReviewerIds: ids('previousReviewerIds'),
    reviewerIds: ids('reviewerIds'),
  });
  const choice = addReviewer === '' || draftReviewerSchema.shape.id.safeParse(addReviewer).success;

  if (!sent.success || !choice) throw new Response('Bad Request', { status: 400 });

  return { values: { ...sent.data, addReviewer }, intent: readListIntent(formData) };
}

/** The values with the chosen reviewer listed once, and the select cleared. */
function withChosen(values: ReviewerAssignmentValues): ReviewerAssignmentValues {
  const chosen = values.addReviewer;
  const reviewerIds = values.reviewerIds.includes(chosen)
    ? values.reviewerIds
    : [...values.reviewerIds, chosen];

  return { ...values, reviewerIds, addReviewer: '' };
}

/** The page with the chosen reviewer listed, or asking for one. */
export function withReviewerAdded(values: ReviewerAssignmentValues): ReviewerAssignmentState {
  return values.addReviewer === ''
    ? { values, fieldErrors: { addReviewer: SELECT_A_REVIEWER } }
    : { values: withChosen(values), fieldErrors: {} };
}

/** The page without the reviewer at `index`, keeping the select's choice. */
export function withReviewerRemoved(
  values: ReviewerAssignmentValues,
  index: number,
): ReviewerAssignmentState {
  return {
    values: { ...values, reviewerIds: values.reviewerIds.filter((_, at) => at !== index) },
    fieldErrors: {},
  };
}

/** The values Continue saves, taking in a reviewer chosen but not added; none listed is refused. */
export function withChosenReviewerTakenIn(
  values: ReviewerAssignmentValues,
): ReviewerAssignmentState {
  const taken = values.addReviewer === '' ? values : withChosen(values);

  return taken.reviewerIds.length === 0
    ? { values: taken, fieldErrors: { addReviewer: SELECT_A_REVIEWER } }
    : { values: taken, fieldErrors: {} };
}

import { schema } from '@fphd/db';
import { INDICATOR_SUBMISSION_STATUSES } from '@fphd/utils/indicator-submission-status';
import { describe, expect, it } from 'vitest';

import { indicatorStatusSchema } from './contract.ts';
import {
  allowedSteps,
  type IndicatorWorkflowContext,
  type IndicatorWorkflowRow,
  mayTakeStep,
  nextState,
  stepsOpenTo,
} from './indicator-workflow.ts';

/** Every context the workflow can be asked about. */
const CONTEXTS: IndicatorWorkflowContext[] = indicatorStatusSchema.options.flatMap(
  (indicatorStatus) =>
    schema.INDICATOR_VERSION_STATUSES.flatMap((versionStatus) =>
      [false, true].flatMap((isLocked) =>
        [null, ...INDICATOR_SUBMISSION_STATUSES].map((latestSubmissionStatus) => ({
          indicatorStatus,
          versionStatus,
          isLocked,
          latestSubmissionStatus,
        })),
      ),
    ),
);

const unsubmitted: IndicatorWorkflowContext = {
  indicatorStatus: 'new',
  versionStatus: 'draft',
  isLocked: false,
  latestSubmissionStatus: null,
};
const withdrawn = { ...unsubmitted, latestSubmissionStatus: 'withdrawn' } as const;
const submitted = { ...unsubmitted, isLocked: true, latestSubmissionStatus: 'submitted' } as const;
const inReview = { ...submitted, latestSubmissionStatus: 'in_review' } as const;

describe('submit', () => {
  it.each([
    ['never submitted', unsubmitted],
    ['withdrawn', withdrawn],
  ])("locks a new indicator's %s draft under a submitted submission", (_, context) => {
    expect(nextState(context, 'submit')).toEqual({
      ok: true,
      state: { versionStatus: 'draft', submissionStatus: 'submitted', isLocked: true },
    });
  });

  it('is refused in every other context', () => {
    const open = CONTEXTS.filter((context) => nextState(context, 'submit').ok);

    expect(open).toEqual([unsubmitted, withdrawn]);
  });

  it('is refused for the draft of a live indicator', () => {
    expect(nextState({ ...unsubmitted, indicatorStatus: 'live' }, 'submit')).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
  });
});

describe('withdraw', () => {
  it.each(['new', 'live'] as const)(
    'unlocks the draft of a %s indicator and ends its submission as withdrawn',
    (indicatorStatus) => {
      expect(nextState({ ...submitted, indicatorStatus }, 'withdraw')).toEqual({
        ok: true,
        state: { versionStatus: 'draft', submissionStatus: 'withdrawn', isLocked: false },
      });
    },
  );

  it('is refused in every other context', () => {
    const open = CONTEXTS.filter((context) => nextState(context, 'withdraw').ok);

    expect(open).toEqual([submitted, { ...submitted, indicatorStatus: 'live' }]);
  });

  it('is refused once the submission is withdrawn', () => {
    expect(nextState(withdrawn, 'withdraw')).toEqual({ ok: false, reason: 'not_allowed' });
  });

  it('is refused once reviewers are assigned', () => {
    expect(nextState(inReview, 'withdraw')).toEqual({ ok: false, reason: 'not_allowed' });
  });
});

describe('assign_reviewers', () => {
  it.each([
    ['submitted', submitted],
    ['in review', inReview],
  ])("puts a new indicator's %s submission in review, its draft still locked", (_, context) => {
    expect(nextState(context, 'assign_reviewers')).toEqual({
      ok: true,
      state: { versionStatus: 'draft', submissionStatus: 'in_review', isLocked: true },
    });
  });

  it('is refused in every other context', () => {
    const open = CONTEXTS.filter((context) => nextState(context, 'assign_reviewers').ok);

    expect(open).toEqual([submitted, inReview]);
  });

  it('is refused for the draft of a live indicator', () => {
    expect(nextState({ ...submitted, indicatorStatus: 'live' }, 'assign_reviewers')).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
  });
});

describe('allowedSteps', () => {
  it.each([
    ['a draft never submitted', unsubmitted, ['submit']],
    ['a withdrawn draft', withdrawn, ['submit']],
    ['a submitted draft', submitted, ['withdraw', 'assign_reviewers']],
    ['a draft in review', inReview, ['assign_reviewers']],
    ['a published version', { ...unsubmitted, versionStatus: 'published' }, []],
  ] as const)('offers %s only the steps open to it', (_, context, steps) => {
    expect(allowedSteps(context)).toEqual(steps);
  });
});

const TEAM = '00000000-0000-7000-8000-00000000000a';
const publisher = { roles: ['publisher'], sub: 'publisher', teams: [TEAM] };
const otherTeam = { ...publisher, teams: ['00000000-0000-7000-8000-00000000000b'] };
const admin = { roles: ['admin'], sub: 'admin', teams: [] };
const manager = { roles: ['imrg-manager'], sub: 'manager', teams: [] };

const unsubmittedRow: IndicatorWorkflowRow = {
  teamId: TEAM,
  indicatorStatus: 'new',
  draftStatus: 'draft',
  draftLocked: false,
  draftSubmissionStatus: null,
};
const submittedRow: IndicatorWorkflowRow = {
  ...unsubmittedRow,
  draftLocked: true,
  draftSubmissionStatus: 'submitted',
};
const inReviewRow: IndicatorWorkflowRow = { ...submittedRow, draftSubmissionStatus: 'in_review' };

describe('mayTakeStep', () => {
  it.each(['submit', 'withdraw'] as const)(
    "lets a publisher %s their own team's indicator only",
    (step) => {
      expect(mayTakeStep(publisher, unsubmittedRow, step)).toBe(true);
      expect(mayTakeStep(otherTeam, unsubmittedRow, step)).toBe(false);
      expect(mayTakeStep(admin, unsubmittedRow, step)).toBe(false);
      expect(mayTakeStep(manager, unsubmittedRow, step)).toBe(false);
    },
  );

  it('lets an IMRG manager alone assign reviewers', () => {
    expect(mayTakeStep(manager, unsubmittedRow, 'assign_reviewers')).toBe(true);
    for (const user of [publisher, admin]) {
      expect(mayTakeStep(user, unsubmittedRow, 'assign_reviewers')).toBe(false);
    }
  });
});

describe('stepsOpenTo', () => {
  it.each([
    ['submit a draft never submitted', unsubmittedRow, ['submit']],
    ['withdraw a submitted draft', submittedRow, ['withdraw']],
  ] as const)("lets a publisher in the indicator's team %s", (_, row, steps) => {
    expect(stepsOpenTo(publisher, row)).toEqual(steps);
  });

  it.each([
    ['assign reviewers to a submitted draft', submittedRow],
    ['change the reviewers of a draft in review', inReviewRow],
  ] as const)('lets an IMRG manager %s', (_, row) => {
    expect(stepsOpenTo(manager, row)).toEqual(['assign_reviewers']);
  });

  it('offers no step to a user who may not take it', () => {
    for (const user of [otherTeam, admin]) {
      expect(stepsOpenTo(user, unsubmittedRow)).toEqual([]);
      expect(stepsOpenTo(user, submittedRow)).toEqual([]);
      expect(stepsOpenTo(user, inReviewRow)).toEqual([]);
    }
  });

  it('offers no step while the indicator has no draft', () => {
    const published = { ...unsubmittedRow, indicatorStatus: 'live', draftStatus: null } as const;

    expect(stepsOpenTo(publisher, published)).toEqual([]);
  });
});

import { schema } from '@fphd/db';
import { INDICATOR_SUBMISSION_STATUSES } from '@fphd/utils/indicator-submission-status';
import { describe, expect, it } from 'vitest';

import { indicatorStatusSchema } from './contract.ts';
import { allowedSteps, type IndicatorWorkflowContext, nextState } from './indicator-workflow.ts';

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
});

describe('allowedSteps', () => {
  it.each([
    ['a draft never submitted', unsubmitted, ['submit']],
    ['a withdrawn draft', withdrawn, ['submit']],
    ['a submitted draft', submitted, ['withdraw']],
    ['a published version', { ...unsubmitted, versionStatus: 'published' }, []],
  ] as const)('offers %s only the steps open to it', (_, context, steps) => {
    expect(allowedSteps(context)).toEqual(steps);
  });
});

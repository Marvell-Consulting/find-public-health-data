import type { schema } from '@fphd/db';
import type { IndicatorSubmissionStatus } from '@fphd/utils/indicator-submission-status';

import type { IndicatorStatus } from './contract.ts';

/** The steps a version takes through review, in the order the workflow allows them. */
export const INDICATOR_STEPS = ['submit', 'withdraw'] as const;

export type IndicatorStep = (typeof INDICATOR_STEPS)[number];

type VersionStatus = schema.IndicatorVersionStatus;

/** What the workflow reads to decide which steps are open: the version and its latest submission. */
export interface IndicatorWorkflowContext {
  indicatorStatus: IndicatorStatus;
  versionStatus: VersionStatus;
  isLocked: boolean;
  /** Null until the version is first submitted. */
  latestSubmissionStatus: IndicatorSubmissionStatus | null;
}

/** Where a step leaves the version and the submission it writes. */
export interface IndicatorWorkflowState {
  versionStatus: VersionStatus;
  submissionStatus: IndicatorSubmissionStatus;
  isLocked: boolean;
}

interface StepEntry {
  from: {
    indicatorStatuses: readonly IndicatorStatus[];
    versionStatuses: readonly VersionStatus[];
    isLocked: boolean;
    submissionStatuses: readonly (IndicatorSubmissionStatus | null)[];
  };
  leadsTo: IndicatorWorkflowState;
}

const STEPS: Readonly<Record<IndicatorStep, StepEntry>> = {
  // A new indicator only, until the update journey can be submitted.
  submit: {
    from: {
      indicatorStatuses: ['new'],
      versionStatuses: ['draft'],
      isLocked: false,
      submissionStatuses: [null, 'withdrawn'],
    },
    leadsTo: { versionStatus: 'draft', submissionStatus: 'submitted', isLocked: true },
  },
  withdraw: {
    from: {
      indicatorStatuses: ['new', 'live'],
      versionStatuses: ['draft'],
      isLocked: true,
      submissionStatuses: ['submitted'],
    },
    leadsTo: { versionStatus: 'draft', submissionStatus: 'withdrawn', isLocked: false },
  },
};

export type IndicatorNextState =
  | { ok: true; state: IndicatorWorkflowState }
  | { ok: false; reason: 'not_allowed' };

function isOpen({ from }: StepEntry, context: IndicatorWorkflowContext): boolean {
  return (
    from.indicatorStatuses.includes(context.indicatorStatus) &&
    from.versionStatuses.includes(context.versionStatus) &&
    from.isLocked === context.isLocked &&
    from.submissionStatuses.includes(context.latestSubmissionStatus)
  );
}

/** Where taking `step` now leads, or why it may not be taken. */
export function nextState(
  context: IndicatorWorkflowContext,
  step: IndicatorStep,
): IndicatorNextState {
  const entry = STEPS[step];
  return isOpen(entry, context)
    ? { ok: true, state: entry.leadsTo }
    : { ok: false, reason: 'not_allowed' };
}

/** The steps open now, whoever may take them. */
export function allowedSteps(context: IndicatorWorkflowContext): IndicatorStep[] {
  return INDICATOR_STEPS.filter((step) => isOpen(STEPS[step], context));
}

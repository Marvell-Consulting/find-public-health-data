import {
  canAssignReviewers,
  canSubmitIndicator,
  canWithdrawSubmission,
  type IndicatorAccess,
  type SessionUser,
} from '@fphd/auth/permissions';
import type { schema } from '@fphd/db';
import type { IndicatorSubmissionStatus } from '@fphd/utils/indicator-submission-status';

import {
  type DraftStatus,
  type DraftSubmissionStatus,
  INDICATOR_STEPS,
  type IndicatorStatus,
  type IndicatorStep,
} from './contract.ts';

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
  /** Who may take the step, a check from `@fphd/auth/permissions`. */
  permission: (user: SessionUser, indicator: Pick<IndicatorAccess, 'teamId'>) => boolean;
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
    permission: canSubmitIndicator,
  },
  withdraw: {
    from: {
      indicatorStatuses: ['new', 'live'],
      versionStatuses: ['draft'],
      isLocked: true,
      submissionStatuses: ['submitted'],
    },
    leadsTo: { versionStatus: 'draft', submissionStatus: 'withdrawn', isLocked: false },
    permission: canWithdrawSubmission,
  },
  // Assigns the first reviewers, or changes them. A new indicator only: an update needs triage.
  assign_reviewers: {
    from: {
      indicatorStatuses: ['new'],
      versionStatuses: ['draft'],
      isLocked: true,
      submissionStatuses: ['submitted', 'in_review'],
    },
    leadsTo: { versionStatus: 'draft', submissionStatus: 'in_review', isLocked: true },
    permission: canAssignReviewers,
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

/** Whether the user may take `step` on the indicator, whether or not it is open now. */
export function mayTakeStep(
  user: SessionUser,
  indicator: Pick<IndicatorAccess, 'teamId'>,
  step: IndicatorStep,
): boolean {
  return STEPS[step].permission(user, indicator);
}

/** An indicator as the list and detail rows describe it, which is enough to place its draft. */
export interface IndicatorWorkflowRow extends Pick<IndicatorAccess, 'teamId'> {
  indicatorStatus: IndicatorStatus;
  draftStatus: DraftStatus | null;
  draftLocked: boolean;
  draftSubmissionStatus: DraftSubmissionStatus | null;
}

/** The steps open now that the user may take; none while there is no draft. */
export function stepsOpenTo(user: SessionUser, indicator: IndicatorWorkflowRow): IndicatorStep[] {
  if (indicator.draftStatus === null) return [];

  return allowedSteps({
    indicatorStatus: indicator.indicatorStatus,
    versionStatus: indicator.draftStatus,
    isLocked: indicator.draftLocked,
    latestSubmissionStatus: indicator.draftSubmissionStatus,
  }).filter((step) => mayTakeStep(user, indicator, step));
}

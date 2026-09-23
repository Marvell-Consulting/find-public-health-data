import type {
  CiMethodKind,
  IndicatorTaskList,
  IndicatorTaskStatus,
  IndicatorTaskStatuses,
} from './contract.ts';
import type { IndicatorDraftVersion } from './indicator-repository.ts';

/** The draft columns the task list judges; each section adds the ones its form writes. */
export type IndicatorTaskListDraft = Pick<
  IndicatorDraftVersion,
  | 'name'
  | 'definition'
  | 'rationale'
  | 'polarity'
  | 'methodology'
  | 'calculatedBy'
  | 'calculatedByOther'
  | 'ciMethodModified'
  | 'ciMethodModifications'
  | 'ciMethodOtherDetail'
> & {
  /** The kind of the draft's CI method, null while none is chosen. */
  ciMethodKind: CiMethodKind | null;
};

export interface IndicatorTaskListSource {
  indicator: Omit<IndicatorTaskList['indicator'], 'name'>;
  draft: IndicatorTaskListDraft;
}

/** Complete once every answer holds text. */
function answered(...answers: readonly (string | null)[]): IndicatorTaskStatus {
  return answers.every((answer) => answer !== null && answer.trim() !== '')
    ? 'completed'
    : 'not_started';
}

/** Complete once the answers the chosen method asks for are held. */
function confidenceIntervals(draft: IndicatorTaskListDraft): IndicatorTaskStatus {
  switch (draft.ciMethodKind) {
    case null:
      return 'not_started';
    case 'none':
      return 'completed';
    case 'other':
      return answered(draft.ciMethodOtherDetail);
    case 'standard':
      if (draft.ciMethodModified === null) return 'not_started';
      return draft.ciMethodModified ? answered(draft.ciMethodModifications) : 'completed';
  }
}

/**
 * The task list state of one draft. Only the tasks with a form appear, so a section is added
 * here as it is built, and until then the page shows its rows as not started.
 */
export function indicatorTaskList({
  draft,
  indicator,
}: IndicatorTaskListSource): IndicatorTaskList {
  // A draft is created by the page that asks for a name, so it always has one.
  const tasks: IndicatorTaskStatuses = {
    name: 'completed',
    'definition-and-rationale': answered(draft.definition, draft.rationale),
    polarity: answered(draft.polarity),
    // The other organisations' details count only when "Other" is the answer.
    calculation: answered(
      draft.methodology,
      draft.calculatedBy,
      ...(draft.calculatedBy === 'other' ? [draft.calculatedByOther] : []),
    ),
    'confidence-intervals': confidenceIntervals(draft),
  };

  return {
    indicator: { ...indicator, name: draft.name },
    isUpdate: indicator.indicatorStatus === 'live',
    canSubmit: Object.values(tasks).every((status) => status === 'completed'),
    tasks,
  };
}

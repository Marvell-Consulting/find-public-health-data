import type { IndicatorTaskList, IndicatorTaskStatus, IndicatorTaskStatuses } from './contract.ts';
import type { IndicatorDraftVersion } from './indicator-repository.ts';

/** The draft columns the task list judges; each section adds the ones its form writes. */
export type IndicatorTaskListDraft = Pick<
  IndicatorDraftVersion,
  'name' | 'definition' | 'rationale' | 'polarity'
>;

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
  };

  return {
    indicator: { ...indicator, name: draft.name },
    isUpdate: indicator.indicatorStatus === 'live',
    canSubmit: Object.values(tasks).every((status) => status === 'completed'),
    tasks,
  };
}

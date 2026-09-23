import type { IndicatorTaskList, IndicatorTaskStatuses } from './contract.ts';

/** The draft columns the task list judges; each section adds the ones its form writes. */
export interface IndicatorTaskListDraft {
  name: string;
}

export interface IndicatorTaskListSource {
  indicator: { id: string; shortId: number };
  draft: IndicatorTaskListDraft;
  /** Whether the indicator also has a published version, which makes this edit an update. */
  hasPublished: boolean;
}

/**
 * The task list state of one draft. Only the tasks with a form appear, so a section is added
 * here as it is built, and until then the page shows its rows as not started.
 */
export function indicatorTaskList({
  draft,
  hasPublished,
  indicator,
}: IndicatorTaskListSource): IndicatorTaskList {
  // A draft is created by the page that asks for a name, so it always has one.
  const tasks: IndicatorTaskStatuses = { name: 'completed' };

  return {
    indicator: { id: indicator.id, shortId: indicator.shortId, name: draft.name },
    isUpdate: hasPublished,
    canSubmit: Object.values(tasks).every((status) => status === 'completed'),
    tasks,
  };
}

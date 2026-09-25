import {
  areConfidenceIntervalsComplete,
  areLinksComplete,
  type CiMethodKind,
  calculationSection,
  definitionAndRationaleSection,
  type IndicatorSection,
  type IndicatorTaskList,
  type IndicatorTaskStatus,
  type IndicatorTaskStatuses,
  isIndicatorSectionComplete,
  justificationsSection,
  otherNotesAndCaveatsSection,
  polaritySection,
  publishingDateSection,
  updateFrequencySection,
  varianceAndQualitySection,
} from './contract.ts';
import type { IndicatorDraftVersion } from './indicator-repository.ts';
import type { IndicatorSectionColumns, IndicatorSectionDraft } from './indicator-section.ts';
import {
  calculationColumns,
  confidenceIntervalsColumns,
  definitionAndRationaleColumns,
  justificationsColumns,
  linksColumns,
  otherNotesAndCaveatsColumns,
  polarityColumns,
  publishingDateColumns,
  updateFrequencyColumns,
  varianceAndQualityColumns,
} from './indicator-sections.ts';

/** The draft columns the task list judges: the name, and those the sections read. */
export type IndicatorTaskListDraft = Pick<IndicatorDraftVersion, 'name'> &
  IndicatorSectionDraft & {
    /** The kind of the draft's CI method, null while none is chosen. */
    ciMethodKind: CiMethodKind | null;
  };

export interface IndicatorTaskListSource {
  indicator: Omit<IndicatorTaskList['indicator'], 'name'>;
  draft: IndicatorTaskListDraft;
}

function taskStatus(complete: boolean): IndicatorTaskStatus {
  return complete ? 'completed' : 'not_started';
}

/**
 * The task list state of one draft. Only the tasks with a form appear, so a section is added
 * here as it is built, and until then the page shows its rows as not started. A section is
 * complete once its stored answers are ones its form would accept.
 */
export function indicatorTaskList({
  draft,
  indicator,
}: IndicatorTaskListSource): IndicatorTaskList {
  const complete = <Field extends string, Values>(
    section: IndicatorSection<Field, Values>,
    columns: IndicatorSectionColumns<Field, unknown>,
  ) => taskStatus(isIndicatorSectionComplete(section, columns.fromDraft(draft)));

  // A draft is created by the page that asks for a name, so it always has one.
  const tasks: IndicatorTaskStatuses = {
    name: 'completed',
    'definition-and-rationale': complete(
      definitionAndRationaleSection,
      definitionAndRationaleColumns,
    ),
    polarity: complete(polaritySection, polarityColumns),
    calculation: complete(calculationSection, calculationColumns),
    'confidence-intervals': taskStatus(
      areConfidenceIntervalsComplete(
        confidenceIntervalsColumns.fromDraft(draft),
        draft.ciMethodKind,
      ),
    ),
    'update-frequency': complete(updateFrequencySection, updateFrequencyColumns),
    'other-notes-and-caveats': complete(otherNotesAndCaveatsSection, otherNotesAndCaveatsColumns),
    'publishing-date': complete(publishingDateSection, publishingDateColumns),
    links: taskStatus(areLinksComplete(linksColumns.fromDraft(draft))),
    'variance-and-quality': complete(varianceAndQualitySection, varianceAndQualityColumns),
    justifications: complete(justificationsSection, justificationsColumns),
  };

  return {
    indicator: { ...indicator, name: draft.name },
    isUpdate: indicator.indicatorStatus === 'live',
    canSubmit: Object.values(tasks).every((status) => status === 'completed'),
    tasks,
  };
}

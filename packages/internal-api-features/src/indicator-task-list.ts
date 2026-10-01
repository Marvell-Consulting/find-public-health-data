import {
  benchmarkingSection,
  type CiMethodKind,
  calculationSection,
  confidenceIntervalsSectionFor,
  copyrightAndDataReuseSection,
  dataQualitySection,
  definitionAndRationaleSection,
  denominatorSection,
  type IndicatorSection,
  type IndicatorTaskList,
  type IndicatorTaskStatus,
  type IndicatorTaskStatuses,
  justificationsSection,
  linksSection,
  numeratorSection,
  otherCommentsSection,
  otherNotesAndCaveatsSection,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  sexAndAgesSection,
  taggingSection,
  updateFrequencySection,
  valueTypeAndUnitsSection,
  varianceAndQualitySection,
} from './contract.ts';
import { denominatorColumns, numeratorColumns } from './indicator-provider-sources.ts';
import type { IndicatorDraftVersion } from './indicator-repository.ts';
import type { IndicatorSectionColumns, IndicatorSectionDraft } from './indicator-section.ts';
import {
  benchmarkingColumns,
  calculationColumns,
  confidenceIntervalsColumns,
  copyrightAndDataReuseColumns,
  dataQualityColumns,
  definitionAndRationaleColumns,
  justificationsColumns,
  linksColumns,
  otherCommentsColumns,
  otherNotesAndCaveatsColumns,
  periodTypeColumns,
  polarityColumns,
  publishingDateColumns,
  sexAndAgesColumns,
  taggingColumns,
  updateFrequencyColumns,
  valueTypeAndUnitsColumns,
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

/**
 * The task list state of one draft. A section is complete once its stored answers are ones its
 * form would accept.
 */
export function indicatorTaskList({
  draft,
  indicator,
}: IndicatorTaskListSource): IndicatorTaskList {
  const complete = <Field extends string, Input, ErrorField extends string, Answers>(
    section: IndicatorSection<Field, unknown, Input, ErrorField, Answers>,
    columns: IndicatorSectionColumns<Field, never, Answers>,
  ): IndicatorTaskStatus =>
    section.schema.safeParse(section.formValues(columns.fromDraft(draft))).success
      ? 'completed'
      : 'not_started';

  // A draft is created by the page that asks for a name, so it always has one.
  const tasks: IndicatorTaskStatuses = {
    name: 'completed',
    'definition-and-rationale': complete(
      definitionAndRationaleSection,
      definitionAndRationaleColumns,
    ),
    'period-type': complete(periodTypeSection, periodTypeColumns),
    polarity: complete(polaritySection, polarityColumns),
    'data-quality': complete(dataQualitySection, dataQualityColumns),
    numerator: complete(numeratorSection, numeratorColumns),
    denominator: complete(denominatorSection, denominatorColumns),
    calculation: complete(calculationSection, calculationColumns),
    'confidence-intervals': complete(
      confidenceIntervalsSectionFor(draft.ciMethodKind),
      confidenceIntervalsColumns,
    ),
    'update-frequency': complete(updateFrequencySection, updateFrequencyColumns),
    'value-type-and-units': complete(valueTypeAndUnitsSection, valueTypeAndUnitsColumns),
    'other-notes-and-caveats': complete(otherNotesAndCaveatsSection, otherNotesAndCaveatsColumns),
    'publishing-date': complete(publishingDateSection, publishingDateColumns),
    links: complete(linksSection, linksColumns),
    'variance-and-quality': complete(varianceAndQualitySection, varianceAndQualityColumns),
    justifications: complete(justificationsSection, justificationsColumns),
    'other-comments': complete(otherCommentsSection, otherCommentsColumns),
    'copyright-and-data-reuse': complete(
      copyrightAndDataReuseSection,
      copyrightAndDataReuseColumns,
    ),
    benchmarking: complete(benchmarkingSection, benchmarkingColumns),
    'sex-and-ages': complete(sexAndAgesSection, sexAndAgesColumns),
    tagging: complete(taggingSection, taggingColumns),
  };

  return {
    indicator: { ...indicator, name: draft.name },
    isUpdate: indicator.indicatorStatus === 'live',
    canSubmit: Object.values(tasks).every((status) => status === 'completed'),
    tasks,
  };
}

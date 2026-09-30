import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { z } from '@fphd/config/zod';
import { PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';
import { standardisationOf, UNITS } from '@fphd/utils/value-type-and-unit';
import { Router } from 'express';

import {
  type Benchmarking,
  type BenchmarkingField,
  benchmarkingSection,
  type Calculation,
  type CalculationField,
  type CiMethodKind,
  type ConfidenceIntervals,
  type ConfidenceIntervalsField,
  calculationSection,
  confidenceIntervalsSection,
  copyrightAndDataReuseQuestions,
  copyrightAndDataReuseSection,
  type DataQualityField,
  dataQualitySection,
  definitionAndRationaleSection,
  denominatorSection,
  goalValue,
  goalValueText,
  type IndicatorDataQuality,
  justificationsQuestions,
  justificationsSection,
  type Links,
  type LinksAnswers,
  type LinksField,
  linksSection,
  missingCiMethodFollowUps,
  numeratorSection,
  type OtherComments,
  type OtherCommentsField,
  type OtherNotesAndCaveats,
  type OtherNotesAndCaveatsField,
  otherCommentsQuestions,
  otherCommentsSection,
  otherNotesAndCaveatsQuestions,
  otherNotesAndCaveatsSection,
  type PeriodType,
  type PeriodTypeField,
  PUBLISHING_NOTICE_DAYS,
  type PublishingDate,
  type PublishingDateField,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  REAL_PUBLISHING_TIME,
  SELECT_CI_METHOD,
  type SexAndAges,
  type SexAndAgesAnswers,
  type SexAndAgesField,
  sexAndAgesSection,
  TAG_LIST_DETAILS,
  TAG_LISTS,
  type Tagging,
  type TaggingAnswers,
  type TaggingField,
  type TaggingFormValues,
  taggingSection,
  ukDate,
  unknownTagMessage,
  updateFrequencySection,
  type ValueTypeAndUnits,
  type ValueTypeAndUnitsField,
  valueTypeAndUnitsSection,
  varianceAndQualityQuestions,
  varianceAndQualitySection,
} from './contract.ts';
import {
  denominatorColumns,
  numeratorColumns,
  providerSourcesServerSection,
} from './indicator-provider-sources.ts';
import type { IndicatorDraftClassification, UkDateTime } from './indicator-repository.ts';
import {
  detailOf,
  type IndicatorSectionColumns,
  indicatorSectionRouter,
  sameNamedColumns,
  yesNoAnswer,
  yesNoDetailColumns,
} from './indicator-section.ts';
import type { IndicatorSection } from './indicator-section-contract.ts';
import type {
  InternalCiMethodRepository,
  InternalIndicatorRepository,
  InternalRepositories,
  InternalTagRepository,
} from './repositories.ts';

export const definitionAndRationaleColumns = sameNamedColumns(definitionAndRationaleSection.fields);

export const polarityColumns = sameNamedColumns(polaritySection.fields);

export const updateFrequencyColumns = sameNamedColumns(updateFrequencySection.fields);

export const calculationColumns: IndicatorSectionColumns<CalculationField, Calculation> = {
  ...sameNamedColumns(calculationSection.fields),
  // Details typed under "Other" are dropped once another organisation is chosen.
  toAttributes: ({ methodology, calculatedBy, calculatedByOther }) => ({
    methodology,
    calculatedBy,
    calculatedByOther: calculatedBy === 'other' ? calculatedByOther : null,
  }),
};

export const valueTypeAndUnitsColumns: IndicatorSectionColumns<
  ValueTypeAndUnitsField,
  ValueTypeAndUnits
> = {
  fromDraft: (draft) => {
    const indirect =
      draft.valueTypeId !== null && standardisationOf(draft.valueTypeId) === 'indirect';

    return {
      valueTypeId: draft.valueTypeId,
      standardPopulation: draft.standardPopulation,
      standardPopulationOther: indirect ? null : draft.standardPopulationDetail,
      referencePopulation: indirect ? draft.standardPopulationDetail : null,
      unitId: draft.unitId,
      unitOther: draft.unitOther,
    };
  },
  // Answers the chosen value type or unit does not ask for are cleared, whatever the form sent.
  toAttributes: (answers) => {
    const standardisation = standardisationOf(answers.valueTypeId);
    const standardPopulation =
      standardisation === 'direct' && answers.standardPopulation !== ''
        ? answers.standardPopulation
        : null;

    return {
      valueTypeId: answers.valueTypeId,
      standardPopulation,
      standardPopulationDetail:
        standardPopulation === 'other'
          ? answers.standardPopulationOther
          : standardisation === 'indirect'
            ? answers.referencePopulation
            : null,
      unitId: answers.unitId,
      unitOther: answers.unitId === UNITS.other.id ? answers.unitOther : null,
    };
  },
};

export type ConfidenceIntervalsWithKind = ConfidenceIntervals & { kind: CiMethodKind };

export const confidenceIntervalsColumns: IndicatorSectionColumns<
  ConfidenceIntervalsField,
  ConfidenceIntervalsWithKind
> = {
  fromDraft: (draft) => ({
    ciMethodId: draft.ciMethodId,
    ciMethodModified: yesNoAnswer(draft.ciMethodModified),
    ciMethodModifications: draft.ciMethodModifications,
    ciMethodOtherDetail: draft.ciMethodOtherDetail,
  }),
  // Answers the chosen method does not ask for are cleared, whatever the form sent.
  toAttributes: ({
    ciMethodId,
    ciMethodModified,
    ciMethodModifications,
    ciMethodOtherDetail,
    kind,
  }) => {
    const modified = kind === 'standard' ? ciMethodModified === 'yes' : null;

    return {
      ciMethodId,
      ciMethodModified: modified,
      ciMethodModifications: modified ? ciMethodModifications : null,
      ciMethodOtherDetail: kind === 'other' ? ciMethodOtherDetail : null,
    };
  },
};

export const dataQualityColumns: IndicatorSectionColumns<DataQualityField, IndicatorDataQuality> = {
  fromDraft: (draft) => ({ dataQualityIssues: yesNoAnswer(draft.dataQualityIssues) }),
  toAttributes: ({ dataQualityIssues }) => ({ dataQualityIssues: dataQualityIssues === 'yes' }),
};

function numberText(value: number | null): string | null {
  return value === null ? null : String(value);
}

export const periodTypeColumns: IndicatorSectionColumns<PeriodTypeField, PeriodType> = {
  fromDraft: (draft) => ({
    periodType: draft.periodTypeId,
    yearType: draft.yearTypeId,
    yearEndDay: numberText(draft.yearEndDay),
    yearEndMonth: numberText(draft.yearEndMonth),
  }),
  // Answers the chosen period and year types do not ask for are cleared, whatever the form sent.
  toAttributes: ({ periodType, yearType, yearEndDay, yearEndMonth }) => {
    const yearTypeId = periodType === PERIOD_TYPES.months.id ? null : yearType;
    const endsOnDate = yearTypeId === YEAR_TYPES.specifiedEndDate.id;

    return {
      periodTypeId: periodType,
      yearTypeId,
      yearEndDay: endsOnDate ? Number(yearEndDay) : null,
      yearEndMonth: endsOnDate ? Number(yearEndMonth) : null,
    };
  },
};

const otherNotesAndCaveatsAnswers = yesNoDetailColumns(
  otherNotesAndCaveatsSection,
  otherNotesAndCaveatsQuestions,
);

export const otherNotesAndCaveatsColumns: IndicatorSectionColumns<
  OtherNotesAndCaveatsField,
  OtherNotesAndCaveats
> = {
  ...otherNotesAndCaveatsAnswers,
  // Disclosure control is stored as its answer, which "Not applicable" makes more than yes/no.
  toAttributes: (answers) => ({
    ...otherNotesAndCaveatsAnswers.toAttributes(answers),
    disclosureControlDetail: detailOf(answers.disclosureControl, answers.disclosureControlDetail),
  }),
};

export const varianceAndQualityColumns = yesNoDetailColumns(
  varianceAndQualitySection,
  varianceAndQualityQuestions,
);

export const justificationsColumns = yesNoDetailColumns(
  justificationsSection,
  justificationsQuestions,
);

const otherCommentsAnswers = yesNoDetailColumns(otherCommentsSection, otherCommentsQuestions);

export const otherCommentsColumns: IndicatorSectionColumns<OtherCommentsField, OtherComments> = {
  ...otherCommentsAnswers,
  // The sponsors and stakeholders are optional, and none given is stored as none.
  toAttributes: (answers) => ({
    ...otherCommentsAnswers.toAttributes(answers),
    sponsorsAndStakeholders: answers.sponsorsAndStakeholders || null,
  }),
};

export const copyrightAndDataReuseColumns = yesNoDetailColumns(
  copyrightAndDataReuseSection,
  copyrightAndDataReuseQuestions,
);

export const benchmarkingColumns: IndicatorSectionColumns<BenchmarkingField, Benchmarking> = {
  fromDraft: (draft) => ({
    hasGoalBenchmark: yesNoAnswer(draft.hasGoalBenchmark),
    goalLowerValue: goalValueText(draft.goalLowerValue),
    goalUpperValue: goalValueText(draft.goalUpperValue),
    goalPolarity: draft.goalPolarity,
    goalPolicyDetail: draft.goalPolicyDetail,
  }),
  // The goal is kept beside a yes alone, whatever the form sent, and a blank detail is none.
  toAttributes: (answers) =>
    answers.hasGoalBenchmark === 'yes'
      ? {
          hasGoalBenchmark: true,
          goalLowerValue: goalValue(answers.goalLowerValue) ?? null,
          goalUpperValue: goalValue(answers.goalUpperValue) ?? null,
          goalPolarity: answers.goalPolarity || null,
          goalPolicyDetail: answers.goalPolicyDetail || null,
        }
      : {
          hasGoalBenchmark: false,
          goalLowerValue: null,
          goalUpperValue: null,
          goalPolarity: null,
          goalPolicyDetail: null,
        },
};

export const linksColumns: IndicatorSectionColumns<LinksField, Links, LinksAnswers> = {
  fromDraft: ({ hasLinks, links }) => ({
    hasLinks: yesNoAnswer(hasLinks),
    links: links.map(({ url, text }) => ({ url, text })),
  }),
  toAttributes: ({ hasLinks }) => ({ hasLinks: hasLinks === 'yes' }),
  // Links sent beside "No" are dropped, whatever the form sent.
  toLists: ({ hasLinks, links }) => ({ links: hasLinks === 'yes' ? links : [] }),
};

// A limit or age the form accepted, which is a whole number or nothing.
function age(value: string): number | null {
  return value === '' ? null : Number(value);
}

export const sexAndAgesColumns: IndicatorSectionColumns<
  SexAndAgesField,
  SexAndAges,
  SexAndAgesAnswers
> = {
  fromDraft: (draft) => ({
    sexes: draft.sexes ?? [],
    ageType: draft.ageType,
    ageRanges: draft.ageRanges,
    specificAge: draft.specificAge,
    specificAgeUnit: draft.specificAgeUnit,
    ageOtherDetail: draft.ageOtherDetail,
  }),
  // Answers the chosen age type does not ask for are cleared, whatever the form sent.
  toAttributes: ({ sexes, ageType, specificAge, specificAgeUnit, ageOtherDetail }) => {
    const specific = ageType === 'specific';

    return {
      sexes,
      ageType,
      specificAge: specific ? age(specificAge) : null,
      specificAgeUnit: specific && specificAgeUnit !== '' ? specificAgeUnit : null,
      ageOtherDetail: ageType === 'other' ? ageOtherDetail : null,
    };
  },
  toLists: ({ ageType, ageRanges }) => ({
    ageRanges:
      ageType === 'range'
        ? ageRanges.map(({ lowerLimit, lowerLimitUnit, upperLimit, upperLimitUnit }) => ({
            lowerLimit: age(lowerLimit),
            lowerLimitUnit: lowerLimitUnit === '' ? null : lowerLimitUnit,
            upperLimit: age(upperLimit),
            upperLimitUnit: upperLimitUnit === '' ? null : upperLimitUnit,
          }))
        : [],
  }),
};

function idsIn(
  classifications: readonly IndicatorDraftClassification[],
  dimension: IndicatorDraftClassification['dimension'],
): string[] {
  return classifications.filter((row) => row.dimension === dimension).map(({ id }) => id);
}

export const taggingColumns: IndicatorSectionColumns<TaggingField, Tagging, TaggingAnswers> = {
  fromDraft: ({ topicIds, classifications, hasRiskFactor, hasFramework }) => ({
    topicIds,
    indicatorTypeIds: idsIn(classifications, 'indicator_type'),
    hasRiskFactor: yesNoAnswer(hasRiskFactor),
    riskFactorIds: idsIn(classifications, 'risk_factor'),
    hasFramework: yesNoAnswer(hasFramework),
    frameworkIds: idsIn(classifications, 'framework'),
  }),
  toAttributes: ({ hasRiskFactor, hasFramework }) => ({
    hasRiskFactor: hasRiskFactor === 'yes',
    hasFramework: hasFramework === 'yes',
  }),
  // The schema has already dropped the tags beside a "No".
  toLists: ({ topicIds, indicatorTypeIds, riskFactorIds, frameworkIds }) => ({
    topicIds,
    classificationIds: {
      indicator_type: indicatorTypeIds,
      risk_factor: riskFactorIds,
      framework: frameworkIds,
    },
  }),
};

/** The form's schema, then that every tag is one the page offers under its own question. */
export function taggingServerSection(
  tags: InternalTagRepository,
): IndicatorSection<TaggingField, Tagging, TaggingFormValues> {
  return {
    ...taggingSection,
    schema: taggingSection.schema.transform(async (answers, ctx) => {
      const options = await tags.listOptions();
      let refused = false;

      for (const list of TAG_LISTS) {
        const offered = new Set(options[TAG_LIST_DETAILS[list].options].map(({ id }) => id));

        if (answers[list].some((id) => !offered.has(id))) {
          ctx.addIssue({ code: 'custom', path: [list], message: unknownTagMessage(list) });
          refused = true;
        }
      }

      return refused ? z.NEVER : answers;
    }),
  };
}

/** The form's schema, then the requirements of the chosen method, read from its row. */
export function confidenceIntervalsServerSection(
  ciMethods: InternalCiMethodRepository,
): IndicatorSection<ConfidenceIntervalsField, ConfidenceIntervalsWithKind> {
  return {
    ...confidenceIntervalsSection,
    schema: confidenceIntervalsSection.schema.transform(async (answers, ctx) => {
      const method = await ciMethods.findById(answers.ciMethodId);

      if (method === undefined) {
        ctx.addIssue({ code: 'custom', path: ['ciMethodId'], message: SELECT_CI_METHOD });
        return z.NEVER;
      }

      const missing = Object.entries(missingCiMethodFollowUps(answers, method.kind));

      for (const [field, message] of missing) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }

      return missing.length > 0 ? z.NEVER : { ...answers, kind: method.kind };
    }),
  };
}

/** The publishing date as an instant: ISO 8601 with the UK offset in force on that date. */
export type PublishingDateWithInstant = PublishingDate & { scheduledPublishAt: string };

// The instant as the repository reads it back, whose local date and time are the answers.
const UK_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}[+-]\d{2}:\d{2}$/;

/** The date and time a publisher typed, from the instant they name in UK time. */
export function publishingDateAnswers(
  scheduledPublishAtUk: string | null,
): Record<PublishingDateField, string | null> {
  if (scheduledPublishAtUk === null) {
    return {
      publishingDateDay: null,
      publishingDateMonth: null,
      publishingDateYear: null,
      publishingTimeHour: null,
      publishingTimeMinute: null,
    };
  }

  const parts = UK_INSTANT.exec(scheduledPublishAtUk);

  if (parts === null) throw new Error(`Not a UK instant: ${scheduledPublishAtUk}`);

  const [year, month, day, hour, minute] = parts.slice(1) as [
    string,
    string,
    string,
    string,
    string,
  ];

  // Day and month as the hint's example gives them; hour and minute as the clock shows them.
  return {
    publishingDateDay: String(Number(day)),
    publishingDateMonth: String(Number(month)),
    publishingDateYear: year,
    publishingTimeHour: hour,
    publishingTimeMinute: minute,
  };
}

export const publishingDateColumns: IndicatorSectionColumns<
  PublishingDateField,
  PublishingDateWithInstant
> = {
  fromDraft: (draft) => publishingDateAnswers(draft.scheduledPublishAtUk),
  toAttributes: ({ scheduledPublishAt }) => ({ scheduledPublishAt: new Date(scheduledPublishAt) }),
};

function ukDateTime(answers: PublishingDate): UkDateTime {
  return {
    year: Number(answers.publishingDateYear),
    month: Number(answers.publishingDateMonth),
    day: Number(answers.publishingDateDay),
    hour: Number(answers.publishingTimeHour),
    minute: Number(answers.publishingTimeMinute),
  };
}

function addIssues(
  ctx: z.RefinementCtx,
  fields: readonly PublishingDateField[],
  message: string,
): void {
  for (const field of fields) ctx.addIssue({ code: 'custom', path: [field], message });
}

/** Whether the answers' date is at least the notice period after the UK date `now` falls on. */
function givesNotice(answers: PublishingDate, now: Date): boolean {
  const chosen = Date.UTC(
    Number(answers.publishingDateYear),
    Number(answers.publishingDateMonth) - 1,
    Number(answers.publishingDateDay),
  );
  return chosen >= ukDate(now, PUBLISHING_NOTICE_DAYS);
}

/**
 * The form's schema, then a date at least the notice period after today's in the UK, whatever
 * the time, and the instant the answers name, which must exist in UK time.
 */
export function publishingDateServerSection(
  indicators: InternalIndicatorRepository,
  now: () => Date,
): IndicatorSection<PublishingDateField, PublishingDateWithInstant> {
  return {
    ...publishingDateSection,
    schema: publishingDateSection.schema.transform(async (answers, ctx) => {
      if (!givesNotice(answers, now())) {
        addIssues(
          ctx,
          ['publishingDateDay', 'publishingDateMonth', 'publishingDateYear'],
          `Publishing date must be at least ${PUBLISHING_NOTICE_DAYS} days from today`,
        );
        return z.NEVER;
      }

      const scheduledPublishAt = await indicators.ukInstant(ukDateTime(answers));

      if (scheduledPublishAt === null) {
        addIssues(ctx, ['publishingTimeHour', 'publishingTimeMinute'], REAL_PUBLISHING_TIME);
        return z.NEVER;
      }

      return { ...answers, scheduledPublishAt };
    }),
  };
}

/** GET and PUT for every section of a draft; `now` is the clock for the publishing date's notice. */
export function indicatorSectionsRouter(
  {
    indicators,
    ciMethods,
    tags,
    dataProviders,
  }: Pick<InternalRepositories, 'indicators' | 'ciMethods' | 'tags' | 'dataProviders'>,
  session: JwtSessionVerifier,
  now: () => Date = () => new Date(),
): Router {
  return Router().use(
    indicatorSectionRouter(
      indicators,
      session,
      definitionAndRationaleSection,
      definitionAndRationaleColumns,
    ),
    indicatorSectionRouter(indicators, session, polaritySection, polarityColumns),
    indicatorSectionRouter(indicators, session, dataQualitySection, dataQualityColumns),
    indicatorSectionRouter(
      indicators,
      session,
      providerSourcesServerSection(numeratorSection, dataProviders),
      numeratorColumns,
    ),
    indicatorSectionRouter(
      indicators,
      session,
      providerSourcesServerSection(denominatorSection, dataProviders),
      denominatorColumns,
    ),
    indicatorSectionRouter(indicators, session, calculationSection, calculationColumns),
    indicatorSectionRouter(
      indicators,
      session,
      confidenceIntervalsServerSection(ciMethods),
      confidenceIntervalsColumns,
    ),
    indicatorSectionRouter(indicators, session, updateFrequencySection, updateFrequencyColumns),
    indicatorSectionRouter(indicators, session, periodTypeSection, periodTypeColumns),
    indicatorSectionRouter(indicators, session, valueTypeAndUnitsSection, valueTypeAndUnitsColumns),
    indicatorSectionRouter(
      indicators,
      session,
      otherNotesAndCaveatsSection,
      otherNotesAndCaveatsColumns,
    ),
    indicatorSectionRouter(
      indicators,
      session,
      publishingDateServerSection(indicators, now),
      publishingDateColumns,
    ),
    indicatorSectionRouter(indicators, session, linksSection, linksColumns),
    indicatorSectionRouter(
      indicators,
      session,
      varianceAndQualitySection,
      varianceAndQualityColumns,
    ),
    indicatorSectionRouter(indicators, session, justificationsSection, justificationsColumns),
    indicatorSectionRouter(indicators, session, otherCommentsSection, otherCommentsColumns),
    indicatorSectionRouter(
      indicators,
      session,
      copyrightAndDataReuseSection,
      copyrightAndDataReuseColumns,
    ),
    indicatorSectionRouter(indicators, session, benchmarkingSection, benchmarkingColumns),
    indicatorSectionRouter(indicators, session, sexAndAgesSection, sexAndAgesColumns),
    indicatorSectionRouter(indicators, session, taggingServerSection(tags), taggingColumns),
  );
}

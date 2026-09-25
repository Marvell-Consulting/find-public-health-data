import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { z } from '@fphd/config/zod';
import { PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';
import { Router } from 'express';

import {
  type Calculation,
  type CalculationField,
  type CiMethodKind,
  type ConfidenceIntervals,
  type ConfidenceIntervalsField,
  calculationSection,
  confidenceIntervalsSection,
  definitionAndRationaleSection,
  type Links,
  type LinksAnswers,
  type LinksField,
  linksSection,
  missingCiMethodFollowUps,
  type OtherNotesAndCaveats,
  type OtherNotesAndCaveatsField,
  otherNotesAndCaveatsSection,
  type PeriodType,
  type PeriodTypeField,
  type PublishingDate,
  type PublishingDateField,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  REAL_PUBLISHING_TIME,
  SELECT_CI_METHOD,
  updateFrequencySection,
} from './contract.ts';
import type { UkDateTime } from './indicator-repository.ts';
import {
  type IndicatorSectionColumns,
  indicatorSectionRouter,
  sameNamedColumns,
} from './indicator-section.ts';
import type { IndicatorSection } from './indicator-section-contract.ts';
import type {
  InternalCiMethodRepository,
  InternalIndicatorRepository,
  InternalRepositories,
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

export type ConfidenceIntervalsWithKind = ConfidenceIntervals & { kind: CiMethodKind };

function yesNo(answer: boolean | null): 'yes' | 'no' | null {
  if (answer === null) return null;
  return answer ? 'yes' : 'no';
}

export const confidenceIntervalsColumns: IndicatorSectionColumns<
  ConfidenceIntervalsField,
  ConfidenceIntervalsWithKind
> = {
  fromDraft: (draft) => ({
    ciMethodId: draft.ciMethodId,
    ciMethodModified: yesNo(draft.ciMethodModified),
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

/** A detail is kept beside a yes alone, whatever the form sent. */
function detailOf(answer: string, detail: string): string | null {
  return answer === 'yes' ? detail : null;
}

export const otherNotesAndCaveatsColumns: IndicatorSectionColumns<
  OtherNotesAndCaveatsField,
  OtherNotesAndCaveats
> = {
  fromDraft: (draft) => ({
    disclosureControl: draft.disclosureControl,
    disclosureControlDetail: draft.disclosureControlDetail,
    roundingApplied: yesNo(draft.roundingApplied),
    roundingDetail: draft.roundingDetail,
    caveatsNeeded: yesNo(draft.caveatsNeeded),
    caveatsDetail: draft.caveatsDetail,
    otherNotesNeeded: yesNo(draft.otherNotesNeeded),
    otherNotesDetail: draft.otherNotesDetail,
  }),
  toAttributes: (answers) => ({
    disclosureControl: answers.disclosureControl,
    disclosureControlDetail: detailOf(answers.disclosureControl, answers.disclosureControlDetail),
    roundingApplied: answers.roundingApplied === 'yes',
    roundingDetail: detailOf(answers.roundingApplied, answers.roundingDetail),
    caveatsNeeded: answers.caveatsNeeded === 'yes',
    caveatsDetail: detailOf(answers.caveatsNeeded, answers.caveatsDetail),
    otherNotesNeeded: answers.otherNotesNeeded === 'yes',
    otherNotesDetail: detailOf(answers.otherNotesNeeded, answers.otherNotesDetail),
  }),
};

export const linksColumns: IndicatorSectionColumns<LinksField, Links, LinksAnswers> = {
  fromDraft: ({ hasLinks, links }) => ({
    hasLinks: yesNo(hasLinks),
    links: links.map(({ url, text }) => ({ url, text })),
  }),
  toAttributes: ({ hasLinks }) => ({ hasLinks: hasLinks === 'yes' }),
  // Links sent beside "No" are dropped, whatever the form sent.
  toLists: ({ hasLinks, links }) => ({ links: hasLinks === 'yes' ? links : [] }),
};

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

const NOTICE_DAYS = 28;
const NOTICE_MS = NOTICE_DAYS * 24 * 60 * 60 * 1000;

/**
 * The form's schema, then the instant the answers name, which must exist in UK time and be at
 * least 28 days after `now`. The notice is about the date, so its error marks the date's parts.
 */
export function publishingDateServerSection(
  indicators: InternalIndicatorRepository,
  now: () => Date,
): IndicatorSection<PublishingDateField, PublishingDateWithInstant> {
  return {
    ...publishingDateSection,
    schema: publishingDateSection.schema.transform(async (answers, ctx) => {
      const scheduledPublishAt = await indicators.ukInstant(ukDateTime(answers));

      if (scheduledPublishAt === null) {
        addIssues(ctx, ['publishingTimeHour', 'publishingTimeMinute'], REAL_PUBLISHING_TIME);
        return z.NEVER;
      }

      if (Date.parse(scheduledPublishAt) - now().getTime() < NOTICE_MS) {
        addIssues(
          ctx,
          ['publishingDateDay', 'publishingDateMonth', 'publishingDateYear'],
          `Publishing date and time must be at least ${NOTICE_DAYS} days in the future`,
        );
        return z.NEVER;
      }

      return { ...answers, scheduledPublishAt };
    }),
  };
}

/** GET and PUT for every section of a draft; `now` is the clock for the publishing date's notice. */
export function indicatorSectionsRouter(
  { indicators, ciMethods }: Pick<InternalRepositories, 'indicators' | 'ciMethods'>,
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
    indicatorSectionRouter(indicators, session, calculationSection, calculationColumns),
    indicatorSectionRouter(
      indicators,
      session,
      confidenceIntervalsServerSection(ciMethods),
      confidenceIntervalsColumns,
    ),
    indicatorSectionRouter(indicators, session, updateFrequencySection, updateFrequencyColumns),
    indicatorSectionRouter(indicators, session, periodTypeSection, periodTypeColumns),
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
  );
}

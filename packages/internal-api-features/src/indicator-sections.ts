import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { z } from '@fphd/config/zod';
import { Router } from 'express';

import {
  type Calculation,
  type CalculationField,
  type CiMethodKind,
  type ConfidenceIntervals,
  type ConfidenceIntervalsField,
  calculationSection,
  confidenceIntervalsSection,
  type DataQualityField,
  dataQualitySection,
  definitionAndRationaleSection,
  type IndicatorDataQuality,
  justificationsQuestions,
  justificationsSection,
  type Links,
  type LinksAnswers,
  type LinksField,
  linksSection,
  missingCiMethodFollowUps,
  type OtherNotesAndCaveats,
  type OtherNotesAndCaveatsField,
  otherNotesAndCaveatsQuestions,
  otherNotesAndCaveatsSection,
  type PublishingDate,
  type PublishingDateField,
  polaritySection,
  publishingDateSection,
  REAL_PUBLISHING_TIME,
  SELECT_CI_METHOD,
  updateFrequencySection,
  varianceAndQualityQuestions,
  varianceAndQualitySection,
} from './contract.ts';
import type { UkDateTime } from './indicator-repository.ts';
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

export const linksColumns: IndicatorSectionColumns<LinksField, Links, LinksAnswers> = {
  fromDraft: ({ hasLinks, links }) => ({
    hasLinks: yesNoAnswer(hasLinks),
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

const UK_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/** The UK calendar date `instant` falls on, moved on `days`, as UTC midnight for comparing. */
function ukDate(instant: Date, days: number): number {
  const parts = UK_DATE.formatToParts(instant);
  const part = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((found) => found.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day') + days);
}

/** Whether the answers' date is at least the notice period after the UK date `now` falls on. */
function givesNotice(answers: PublishingDate, now: Date): boolean {
  const chosen = Date.UTC(
    Number(answers.publishingDateYear),
    Number(answers.publishingDateMonth) - 1,
    Number(answers.publishingDateDay),
  );
  return chosen >= ukDate(now, NOTICE_DAYS);
}

/**
 * The form's schema, then a date at least 28 days after today's in the UK, whatever the time,
 * and the instant the answers name, which must exist in UK time.
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
          `Publishing date must be at least ${NOTICE_DAYS} days from today`,
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
    indicatorSectionRouter(indicators, session, dataQualitySection, dataQualityColumns),
    indicatorSectionRouter(indicators, session, calculationSection, calculationColumns),
    indicatorSectionRouter(
      indicators,
      session,
      confidenceIntervalsServerSection(ciMethods),
      confidenceIntervalsColumns,
    ),
    indicatorSectionRouter(indicators, session, updateFrequencySection, updateFrequencyColumns),
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
  );
}

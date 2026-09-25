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
  definitionAndRationaleSection,
  missingCiMethodFollowUps,
  type OtherNotesAndCaveats,
  type OtherNotesAndCaveatsField,
  otherNotesAndCaveatsSection,
  polaritySection,
  SELECT_CI_METHOD,
  updateFrequencySection,
} from './contract.ts';
import {
  type IndicatorSectionColumns,
  indicatorSectionRouter,
  sameNamedColumns,
} from './indicator-section.ts';
import type { IndicatorSection } from './indicator-section-contract.ts';
import type { InternalCiMethodRepository, InternalRepositories } from './repositories.ts';

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

export type JudgedConfidenceIntervals = ConfidenceIntervals & { kind: CiMethodKind };

function yesNo(answer: boolean | null): string | null {
  if (answer === null) return null;
  return answer ? 'yes' : 'no';
}

export const confidenceIntervalsColumns: IndicatorSectionColumns<
  ConfidenceIntervalsField,
  JudgedConfidenceIntervals
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

/** The form's schema, then the requirements of the chosen method, read from its row. */
export function judgedConfidenceIntervalsSection(
  ciMethods: InternalCiMethodRepository,
): IndicatorSection<ConfidenceIntervalsField, JudgedConfidenceIntervals> {
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

/** GET and PUT for every section of a draft. */
export function indicatorSectionsRouter(
  { indicators, ciMethods }: Pick<InternalRepositories, 'indicators' | 'ciMethods'>,
  session: JwtSessionVerifier,
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
      judgedConfidenceIntervalsSection(ciMethods),
      confidenceIntervalsColumns,
    ),
    indicatorSectionRouter(indicators, session, updateFrequencySection, updateFrequencyColumns),
    indicatorSectionRouter(
      indicators,
      session,
      otherNotesAndCaveatsSection,
      otherNotesAndCaveatsColumns,
    ),
  );
}

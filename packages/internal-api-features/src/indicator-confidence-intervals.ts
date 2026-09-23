import type { JwtSessionVerifier } from '@fphd/auth/jwt-session';
import { z } from '@fphd/config/zod';
import type { Router } from 'express';

import {
  type CiMethodKind,
  type ConfidenceIntervals,
  type ConfidenceIntervalsField,
  confidenceIntervalsSection,
  SELECT_CI_METHOD,
} from './indicator-confidence-intervals-contract.ts';
import { indicatorSectionRouter } from './indicator-section.ts';
import type { IndicatorSection } from './indicator-section-contract.ts';
import type { InternalCiMethodRepository, InternalIndicatorRepository } from './repositories.ts';

type JudgedConfidenceIntervals = ConfidenceIntervals & { kind: CiMethodKind };

/** The answers a method of each kind requires beyond itself, and the message for each missing. */
function missingFollowUps(
  { ciMethodModified, ciMethodModifications, ciMethodOtherDetail }: ConfidenceIntervals,
  kind: CiMethodKind,
): Partial<Record<ConfidenceIntervalsField, string>> {
  if (kind === 'other') {
    return ciMethodOtherDetail === ''
      ? { ciMethodOtherDetail: 'Enter details of the other confidence interval method used' }
      : {};
  }

  if (kind === 'none') return {};

  if (ciMethodModified === '') {
    return { ciMethodModified: 'Select whether any modifications were used' };
  }

  return ciMethodModified === 'yes' && ciMethodModifications === ''
    ? { ciMethodModifications: 'Enter a description of the modifications used' }
    : {};
}

/** The form's schema, then the requirements of the chosen method, read from its row. */
function judgedSection(
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

      const missing = Object.entries(missingFollowUps(answers, method.kind));

      for (const [field, message] of missing) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }

      return missing.length > 0 ? z.NEVER : { ...answers, kind: method.kind };
    }),
  };
}

function yesNo(answer: boolean | null): string | null {
  if (answer === null) return null;
  return answer ? 'yes' : 'no';
}

export function indicatorConfidenceIntervalsRouter(
  indicators: InternalIndicatorRepository,
  ciMethods: InternalCiMethodRepository,
  session: JwtSessionVerifier,
): Router {
  return indicatorSectionRouter(indicators, session, judgedSection(ciMethods), {
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
  });
}

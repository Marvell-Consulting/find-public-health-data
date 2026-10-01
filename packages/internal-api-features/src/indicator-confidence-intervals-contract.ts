import { z } from '@fphd/config/zod';
import { CI_METHOD_KINDS, type CiMethodKind } from '@fphd/utils/ci-method-kind';

import { type IndicatorSection, textSection } from './indicator-section-contract.ts';
import { longText } from './text-contract.ts';

export const ciMethodKindSchema = z.enum(CI_METHOD_KINDS);

export const ciMethodSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  /** The method's standard description, which not every method has yet. */
  description: z.string().nullable(),
  kind: ciMethodKindSchema,
});

/** Every method a publisher may choose, in the order the form lists them. */
export const ciMethodListSchema = z.array(ciMethodSchema);

export type { CiMethodKind };
export type CiMethod = z.infer<typeof ciMethodSchema>;

const fields = z.enum([
  'ciMethodId',
  'hasCiMethodModifications',
  'ciMethodModificationsDetail',
  'ciMethodDetail',
]);

const SELECT_CI_METHOD = 'Select the confidence interval method used';

/**
 * What the form can judge alone: that a method is chosen. Which of the other answers are
 * required depends on the method's kind, which only the API reads, so it judges them.
 */
const schema = z.object({
  ciMethodId: z.uuid(SELECT_CI_METHOD),
  hasCiMethodModifications: z.enum(['', 'yes', 'no'], {
    error: 'Select whether any modifications were used',
  }),
  ciMethodModificationsDetail: longText('Description of the modifications'),
  ciMethodDetail: longText('Details of the other confidence interval method'),
});

export type ConfidenceIntervalsField = z.infer<typeof fields>;
export type ConfidenceIntervals = z.infer<typeof schema>;

export const confidenceIntervalsSection: IndicatorSection<
  ConfidenceIntervalsField,
  ConfidenceIntervals
> = textSection({ key: 'confidence-intervals', fields, schema });

/** The answers a method of each kind requires beyond itself, and the message for each missing. */
function missingCiMethodFollowUps(
  { hasCiMethodModifications, ciMethodModificationsDetail, ciMethodDetail }: ConfidenceIntervals,
  kind: CiMethodKind,
): Partial<Record<ConfidenceIntervalsField, string>> {
  if (kind === 'other') {
    return ciMethodDetail === ''
      ? { ciMethodDetail: 'Enter details of the other confidence interval method used' }
      : {};
  }

  if (kind === 'none') return {};

  if (hasCiMethodModifications === '') {
    return { hasCiMethodModifications: 'Select whether any modifications were used' };
  }

  return hasCiMethodModifications === 'yes' && ciMethodModificationsDetail === ''
    ? { ciMethodModificationsDetail: 'Enter a description of the modifications used' }
    : {};
}

/**
 * The section once the chosen method's kind is known: the form's schema, then the answers that
 * kind asks for. With no kind, no method is chosen.
 */
export function confidenceIntervalsSectionFor(
  kind: CiMethodKind | null,
): IndicatorSection<ConfidenceIntervalsField, ConfidenceIntervals> {
  return {
    ...confidenceIntervalsSection,
    schema: schema.superRefine((answers, ctx) => {
      const missing =
        kind === null ? { ciMethodId: SELECT_CI_METHOD } : missingCiMethodFollowUps(answers, kind);

      for (const [field, message] of Object.entries(missing)) {
        ctx.addIssue({ code: 'custom', path: [field], message });
      }
    }),
  };
}

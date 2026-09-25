import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  yesNoSchema,
} from './indicator-section-contract.ts';

const fields = z.enum([
  'disclosureControl',
  'disclosureControlDetail',
  'roundingApplied',
  'roundingDetail',
  'caveatsNeeded',
  'caveatsDetail',
  'otherNotesNeeded',
  'otherNotesDetail',
]);

export type OtherNotesAndCaveatsField = z.infer<typeof fields>;

/** Answered yes, no or "Not applicable", so stored as its answer rather than as a yes/no. */
const disclosureControlQuestion = {
  answer: 'disclosureControl',
  detail: 'disclosureControlDetail',
  detailRequired: 'Provide details of the disclosure control',
} as const satisfies DetailedQuestion<OtherNotesAndCaveatsField>;

/** The yes/no questions whose yes asks for details. */
export const otherNotesAndCaveatsQuestions = [
  {
    answer: 'roundingApplied',
    detail: 'roundingDetail',
    detailRequired: 'Provide details of the rounding',
  },
  {
    answer: 'caveatsNeeded',
    detail: 'caveatsDetail',
    detailRequired: 'Provide details of the caveats',
  },
  {
    answer: 'otherNotesNeeded',
    detail: 'otherNotesDetail',
    detailRequired: 'Provide details of the other notes',
  },
] as const satisfies readonly DetailedQuestion<OtherNotesAndCaveatsField>[];

const schema = requireDetails(
  z.object({
    disclosureControl: z.enum(['yes', 'no', 'not-applicable'], {
      error: 'Select whether disclosure control has been applied',
    }),
    disclosureControlDetail: z.string().trim(),
    roundingApplied: yesNoSchema('Select whether rounding has been applied'),
    roundingDetail: z.string().trim(),
    caveatsNeeded: yesNoSchema('Select whether there are any caveats needed'),
    caveatsDetail: z.string().trim(),
    otherNotesNeeded: yesNoSchema('Select whether there are any other notes needed'),
    otherNotesDetail: z.string().trim(),
  }),
  [disclosureControlQuestion, ...otherNotesAndCaveatsQuestions],
);

export type OtherNotesAndCaveats = z.infer<typeof schema>;

export const otherNotesAndCaveatsSection: IndicatorSection<
  OtherNotesAndCaveatsField,
  OtherNotesAndCaveats
> = { key: 'other-notes-and-caveats', fields, schema };

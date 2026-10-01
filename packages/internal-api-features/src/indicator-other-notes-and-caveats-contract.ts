import { z } from '@fphd/config/zod';
import { INDICATOR_DISCLOSURE_CONTROL } from '@fphd/utils/disclosure-control';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  textSection,
  yesNoSchema,
} from './indicator-section-contract.ts';
import { longText } from './text-contract.ts';

const fields = z.enum([
  'disclosureControl',
  'disclosureControlDetail',
  'hasRounding',
  'roundingDetail',
  'hasCaveats',
  'caveatsDetail',
  'hasOtherNotes',
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
    answer: 'hasRounding',
    detail: 'roundingDetail',
    detailRequired: 'Provide details of the rounding',
  },
  {
    answer: 'hasCaveats',
    detail: 'caveatsDetail',
    detailRequired: 'Provide details of the caveats',
  },
  {
    answer: 'hasOtherNotes',
    detail: 'otherNotesDetail',
    detailRequired: 'Provide details of the other notes',
  },
] as const satisfies readonly DetailedQuestion<OtherNotesAndCaveatsField>[];

const schema = requireDetails(
  z.object({
    disclosureControl: z.enum(INDICATOR_DISCLOSURE_CONTROL, {
      error: 'Select whether disclosure control has been applied',
    }),
    disclosureControlDetail: longText('Details of the disclosure control'),
    hasRounding: yesNoSchema('Select whether rounding has been applied'),
    roundingDetail: longText('Details of the rounding'),
    hasCaveats: yesNoSchema('Select whether there are any caveats needed'),
    caveatsDetail: longText('Details of the caveats'),
    hasOtherNotes: yesNoSchema('Select whether there are any other notes needed'),
    otherNotesDetail: longText('Details of the other notes'),
  }),
  [disclosureControlQuestion, ...otherNotesAndCaveatsQuestions],
);

export type OtherNotesAndCaveats = z.infer<typeof schema>;

export const otherNotesAndCaveatsSection: IndicatorSection<
  OtherNotesAndCaveatsField,
  OtherNotesAndCaveats
> = textSection({ key: 'other-notes-and-caveats', fields, schema });

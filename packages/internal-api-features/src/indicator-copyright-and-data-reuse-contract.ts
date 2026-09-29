import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  yesNoSchema,
} from './indicator-section-contract.ts';

const fields = z.enum([
  'copyrightNonDefault',
  'copyrightDetail',
  'dataReuseNonDefault',
  'dataReuseDetail',
]);

export type CopyrightAndDataReuseField = z.infer<typeof fields>;

export const copyrightAndDataReuseQuestions = [
  {
    answer: 'copyrightNonDefault',
    detail: 'copyrightDetail',
    detailRequired: 'Provide details of the copyright',
  },
  {
    answer: 'dataReuseNonDefault',
    detail: 'dataReuseDetail',
    detailRequired: 'Provide details of the data re-use',
  },
] as const satisfies readonly DetailedQuestion<CopyrightAndDataReuseField>[];

const schema = requireDetails(
  z.object({
    copyrightNonDefault: yesNoSchema(
      'Select whether the copyright is anything other than Crown copyright',
    ),
    copyrightDetail: z.string().trim(),
    dataReuseNonDefault: yesNoSchema('Select whether the data re-use is different to the default'),
    dataReuseDetail: z.string().trim(),
  }),
  copyrightAndDataReuseQuestions,
);

export type CopyrightAndDataReuse = z.infer<typeof schema>;

/** Whether the indicator's copyright and data re-use terms differ from the defaults, and how. */
export const copyrightAndDataReuseSection: IndicatorSection<
  CopyrightAndDataReuseField,
  CopyrightAndDataReuse
> = { key: 'copyright-and-data-reuse', fields, schema };

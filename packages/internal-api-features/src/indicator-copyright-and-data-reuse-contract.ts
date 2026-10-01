import { z } from '@fphd/config/zod';

import {
  type DetailedQuestion,
  type IndicatorSection,
  requireDetails,
  textSection,
  yesNoSchema,
} from './indicator-section-contract.ts';

const fields = z.enum([
  'hasCustomCopyright',
  'customCopyrightDetail',
  'hasCustomDataReuse',
  'customDataReuseDetail',
]);

export type CopyrightAndDataReuseField = z.infer<typeof fields>;

export const copyrightAndDataReuseQuestions = [
  {
    answer: 'hasCustomCopyright',
    detail: 'customCopyrightDetail',
    detailRequired: 'Provide details of the copyright',
  },
  {
    answer: 'hasCustomDataReuse',
    detail: 'customDataReuseDetail',
    detailRequired: 'Provide details of the data re-use',
  },
] as const satisfies readonly DetailedQuestion<CopyrightAndDataReuseField>[];

const schema = requireDetails(
  z.object({
    hasCustomCopyright: yesNoSchema(
      'Select whether the copyright is anything other than Crown copyright',
    ),
    customCopyrightDetail: z.string().trim(),
    hasCustomDataReuse: yesNoSchema('Select whether the data re-use is different to the default'),
    customDataReuseDetail: z.string().trim(),
  }),
  copyrightAndDataReuseQuestions,
);

export type CopyrightAndDataReuse = z.infer<typeof schema>;

/** Whether the indicator's copyright and data re-use terms differ from the defaults, and how. */
export const copyrightAndDataReuseSection: IndicatorSection<
  CopyrightAndDataReuseField,
  CopyrightAndDataReuse
> = textSection({ key: 'copyright-and-data-reuse', fields, schema });

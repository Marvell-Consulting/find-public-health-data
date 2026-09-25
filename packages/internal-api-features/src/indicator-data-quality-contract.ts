import { z } from '@fphd/config/zod';

import { type IndicatorSection, yesNoSchema } from './indicator-section-contract.ts';

const fields = z.enum(['dataQualityIssues']);

const schema = z.object({
  dataQualityIssues: yesNoSchema(
    'Select whether there are any data quality issues with this indicator',
  ),
});

export type DataQualityField = z.infer<typeof fields>;
export type IndicatorDataQuality = z.infer<typeof schema>;

export const dataQualitySection: IndicatorSection<DataQualityField, IndicatorDataQuality> = {
  key: 'data-quality',
  fields,
  schema,
};

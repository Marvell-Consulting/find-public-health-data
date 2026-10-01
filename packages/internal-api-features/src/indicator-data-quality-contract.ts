import { z } from '@fphd/config/zod';

import { type IndicatorSection, textSection, yesNoSchema } from './indicator-section-contract.ts';

const fields = z.enum(['hasDataQualityIssues']);

const schema = z.object({
  hasDataQualityIssues: yesNoSchema(
    'Select whether there are any data quality issues with this indicator',
  ),
});

export type DataQualityField = z.infer<typeof fields>;
export type IndicatorDataQuality = z.infer<typeof schema>;

export const dataQualitySection: IndicatorSection<DataQualityField, IndicatorDataQuality> =
  textSection({ key: 'data-quality', fields, schema });

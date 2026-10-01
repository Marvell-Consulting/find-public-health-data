import { z } from '@fphd/config/zod';
import { UPDATE_FREQUENCIES } from '@fphd/utils/update-frequency';

import { type IndicatorSection, textSection } from './indicator-section-contract.ts';

const fields = z.enum(['updateFrequency']);

const schema = z.object({
  updateFrequency: z.enum(UPDATE_FREQUENCIES, {
    error: 'Select how often this indicator will be updated',
  }),
});

export type UpdateFrequencyField = z.infer<typeof fields>;
export type IndicatorUpdateFrequency = z.infer<typeof schema>;

export const updateFrequencySection: IndicatorSection<
  UpdateFrequencyField,
  IndicatorUpdateFrequency
> = textSection({ key: 'update-frequency', fields, schema });

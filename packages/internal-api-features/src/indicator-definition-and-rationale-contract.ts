import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

const fields = z.enum(['definition', 'rationale']);

const schema = z.object({
  definition: z.string().trim().min(1, 'Enter the definition of the indicator'),
  rationale: z.string().trim().min(1, 'Enter the rationale for the indicator'),
});

export type DefinitionAndRationaleField = z.infer<typeof fields>;
export type DefinitionAndRationale = z.infer<typeof schema>;

export const definitionAndRationaleSection: IndicatorSection<
  DefinitionAndRationaleField,
  DefinitionAndRationale
> = { key: 'definition-and-rationale', fields, schema };

import { z } from '@fphd/config/zod';

import { type IndicatorSection, textSection } from './indicator-section-contract.ts';
import { longText } from './text-contract.ts';

const fields = z.enum(['definition', 'rationale']);

const schema = z.object({
  definition: longText('Definition').min(1, 'Enter the definition of the indicator'),
  rationale: longText('Rationale').min(1, 'Enter the rationale for the indicator'),
});

export type DefinitionAndRationaleField = z.infer<typeof fields>;
export type DefinitionAndRationale = z.infer<typeof schema>;

export const definitionAndRationaleSection: IndicatorSection<
  DefinitionAndRationaleField,
  DefinitionAndRationale
> = textSection({ key: 'definition-and-rationale', fields, schema });

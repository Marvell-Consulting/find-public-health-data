import type { Polarity } from '@fphd/utils/polarity';
import type { UpdateFrequency } from '@fphd/utils/update-frequency';

// Pholio's lookup rows become the service's values; a name with none stops the export.
export const PHOLIO_POLARITIES: Readonly<Record<string, Polarity>> = {
  'RAG - High is good': 'higher-is-better',
  'RAG - Low is good': 'lower-is-better',
  'BOB - Blue orange blue': 'no-polarity',
  'Not applicable': 'no-comparison-possible',
};

export function translatePolarity(name: string): Polarity {
  const value = PHOLIO_POLARITIES[name];
  if (value === undefined)
    throw new Error(`No polarity value for the Fingertips polarity ${JSON.stringify(name)}`);
  return value;
}

export const PHOLIO_FREQUENCIES: Readonly<Record<string, UpdateFrequency>> = {
  Annual: 'annually',
  'Monthly (not yet in use)': 'monthly',
  'Quarterly (not yet in use)': 'quarterly',
};

export function translateFrequency(name: string): UpdateFrequency {
  const value = PHOLIO_FREQUENCIES[name];
  if (value === undefined)
    throw new Error(
      `No update frequency value for the Fingertips frequency ${JSON.stringify(name)}`,
    );
  return value;
}

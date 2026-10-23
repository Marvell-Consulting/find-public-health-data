/**
 * Classification dimensions available to indicators.
 */
export const CLASSIFICATION_DIMENSIONS = [
  'indicator_type',
  'population',
  'inequality',
  'framework',
  'life_stage',
] as const;

export type ClassificationDimension = (typeof CLASSIFICATION_DIMENSIONS)[number];

/** The dimensions a publisher tags an indicator with on the tagging page. */
export const TAGGING_DIMENSIONS = [
  'indicator_type',
  'life_stage',
  'framework',
] as const satisfies readonly ClassificationDimension[];

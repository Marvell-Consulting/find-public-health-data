/**
 * The ways an indicator is classified beyond its topic: what kind of measure it is, the
 * population it describes, the risk factor it relates to, the inequality it can be broken
 * down by, and the frameworks it reports into.
 */
export const CLASSIFICATION_DIMENSIONS = [
  'indicator_type',
  'population',
  'risk_factor',
  'inequality',
  'framework',
] as const;

export type ClassificationDimension = (typeof CLASSIFICATION_DIMENSIONS)[number];

/** The dimensions a publisher tags an indicator with on the tagging page. */
export const TAGGING_DIMENSIONS = [
  'indicator_type',
  'risk_factor',
  'framework',
] as const satisfies readonly ClassificationDimension[];

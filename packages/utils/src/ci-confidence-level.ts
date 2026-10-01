/** The confidence levels of a version's intervals, which no page asks for yet. */
export const CI_CONFIDENCE_LEVELS = ['95', '99.8', 'both'] as const;

export type CiConfidenceLevel = (typeof CI_CONFIDENCE_LEVELS)[number];

export const CI_CONFIDENCE_LEVEL_LABELS: Readonly<Record<CiConfidenceLevel, string>> = {
  '95': '95%',
  '99.8': '99.8%',
  both: '95% and 99.8%',
};

/** The two halves of a calculation, each of which names where its data comes from. */
export const INDICATOR_SOURCE_PARTS = ['numerator', 'denominator'] as const;

export type IndicatorSourcePart = (typeof INDICATOR_SOURCE_PARTS)[number];

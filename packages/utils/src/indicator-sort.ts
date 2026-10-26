export const INDICATOR_SORTS = [
  'subtopic-asc',
  'subtopic-desc',
  'name-asc',
  'name-desc',
  'period-desc',
  'trend-desc',
  'trend-asc',
  'trend-better',
  'trend-worse',
] as const;

export type IndicatorSort = (typeof INDICATOR_SORTS)[number];

export function indicatorSort(value: unknown): IndicatorSort | undefined {
  return INDICATOR_SORTS.find((sort) => sort === value);
}

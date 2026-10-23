// Provisional migration names distinguish datasets while their source ids stay unchanged.
export const INDICATOR_NAME_MAPPINGS = [
  {
    fingertipsId: 90366,
    sourceName: 'Life expectancy at birth',
    name: 'Life expectancy at birth (annual and three-year estimates)',
  },
  {
    fingertipsId: 93283,
    sourceName: 'Life expectancy at birth',
    name: 'Life expectancy at birth (five-year estimates for small areas)',
  },
  {
    fingertipsId: 90776,
    sourceName: 'Chlamydia detection rate per 100,000 aged 15 to 24 years',
    name: 'Chlamydia detection rate per 100,000 aged 15 to 24 years (Females)',
  },
  {
    fingertipsId: 91514,
    sourceName: 'Chlamydia detection rate per 100,000 aged 15 to 24 years',
    name: 'Chlamydia detection rate per 100,000 aged 15 to 24 years (Males and total population)',
  },
  {
    fingertipsId: 93280,
    sourceName: 'Fuel poverty (low income, low energy efficiency methodology)',
    name: 'Fuel poverty (low income, low energy efficiency): small-area estimates',
  },
  {
    fingertipsId: 93759,
    sourceName: 'Fuel poverty (low income, low energy efficiency methodology)',
    name: 'Fuel poverty (low income, low energy efficiency): annual trends',
  },
] as const;

export function reviewedIndicatorName(fingertipsId: number, sourceName: string): string {
  const mapping = INDICATOR_NAME_MAPPINGS.find((entry) => entry.fingertipsId === fingertipsId);
  if (!mapping) return sourceName;
  if (mapping.sourceName !== sourceName)
    throw new Error(
      `Indicator ${fingertipsId}: source name changed from ${JSON.stringify(mapping.sourceName)} to ${JSON.stringify(sourceName)}; review its migration name`,
    );
  return mapping.name;
}

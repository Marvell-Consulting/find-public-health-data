/** What an indicator's values are, in the form's order. Each id is its `value_type` row's. */
export const VALUE_TYPES = {
  count: { id: '01a0d8a5-3ca2-7315-bfca-96c7324d4347', name: 'Count' },
  crudeRate: { id: '01a0d8a5-3ca2-7315-bfca-96c8c77cad18', name: 'Crude rate' },
  directlyStandardisedRate: {
    id: '01a0d8a5-3ca2-7315-bfca-96c9664c846c',
    name: 'Directly standardised rate',
  },
  excessRisk: { id: '01a0d8a5-3ca2-7315-bfca-96ca4c9608e9', name: 'Excess risk' },
  gap: { id: '01a0d8a5-3ca2-7315-bfca-96cb03846bff', name: 'Gap' },
  indirectlyStandardisedProportion: {
    id: '01a0d8a5-3ca2-7315-bfca-96cc2dc711c3',
    name: 'Indirectly standardised proportion',
  },
  indirectlyStandardisedRatio: {
    id: '01a0d8a5-3ca2-7315-bfca-96cda63ea940',
    name: 'Indirectly standardised ratio',
  },
  lifeExpectancy: { id: '01a0d8a5-3ca2-7315-bfca-96ce5ffc8d47', name: 'Life expectancy' },
  mean: { id: '01a0d8a5-3ca2-7315-bfca-96cff286704d', name: 'Mean' },
  median: { id: '01a0d8a5-3ca2-7315-bfca-96d0928fd186', name: 'Median' },
  percentagePoint: { id: '01a0d8a5-3ca2-7315-bfca-96d1b508d83f', name: 'Percentage point' },
  proportion: { id: '01a0d8a5-3ca2-7315-bfca-96d2031a65e7', name: 'Proportion' },
  ratio: { id: '01a0d8a5-3ca2-7315-bfca-96d34a17c74b', name: 'Ratio' },
  score: { id: '01a0d8a5-3ca2-7315-bfca-96d4cc7f7bcb', name: 'Score' },
  slopeIndexOfInequality: {
    id: '01a0d8a5-3ca2-7315-bfca-96d54168d21f',
    name: 'Slope index of inequality',
  },
} as const;

/** The units of an indicator's values, in the form's order. Each id is its `unit` row's. */
export const UNITS = {
  percent: { id: '01a0d8a5-3ca2-7315-bfca-96d615820bd4', name: '%' },
  per100: { id: '01a0d8a5-3ca2-7315-bfca-96d787920e40', name: 'per 100' },
  per1000: { id: '01a0d8a5-3ca2-7315-bfca-96d8d8d7aec2', name: 'per 1,000' },
  per10000: { id: '01a0d8a5-3ca2-7315-bfca-96d97b88dbff', name: 'per 10,000' },
  per100000: { id: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9', name: 'per 100,000' },
  per1000000: { id: '01a0d8a5-3ca2-7315-bfca-96dbaf432da2', name: 'per 1,000,000' },
  minutes: { id: '01a0d8a5-3ca2-7315-bfca-96dca2ab3487', name: 'minutes' },
  hours: { id: '01a0d8a5-3ca2-7315-bfca-96dd9ae52dc5', name: 'hours' },
  days: { id: '01a0d8a5-3ca2-7315-bfca-96de5fe00871', name: 'days' },
  weeks: { id: '01a0d8a5-3ca2-7315-bfca-96df3a570e5d', name: 'weeks' },
  months: { id: '01a0d8a5-3ca2-7315-bfca-96e0128fd88d', name: 'months' },
  years: { id: '01a0d8a5-3ca2-7315-bfca-96e1a3b040d3', name: 'years' },
  pounds: { id: '01a0d8a5-3ca2-7315-bfca-96e2d3cf5df0', name: '£' },
  poundsPerCapita: { id: '01a0d8a5-3ca2-7315-bfca-96e3aae4dc98', name: '£ per capita' },
  noUnit: { id: '01a0d8a5-3ca2-7315-bfca-96e4a96bfc8e', name: 'No unit' },
  // Named by the publisher in `unit_other`.
  other: { id: '01a0d8a5-3ca2-7315-bfca-96e5cee57158', name: 'Other' },
} as const;

export const UNIT_OTHER_MAX_LENGTH = 100;

/** The value types standardised against a reference population the publisher names. */
export const INDIRECTLY_STANDARDISED_VALUE_TYPE_IDS: readonly string[] = [
  VALUE_TYPES.indirectlyStandardisedProportion.id,
  VALUE_TYPES.indirectlyStandardisedRatio.id,
];

/** How a value type is standardised, which decides what the form asks of its population. */
export function standardisationOf(valueTypeId: string): 'direct' | 'indirect' | null {
  if (valueTypeId === VALUE_TYPES.directlyStandardisedRate.id) return 'direct';
  return INDIRECTLY_STANDARDISED_VALUE_TYPE_IDS.includes(valueTypeId) ? 'indirect' : null;
}

/** The standard population of a directly standardised rate, or one the publisher names. */
export const STANDARD_POPULATIONS = ['esp-2013', 'other'] as const;

export type StandardPopulation = (typeof STANDARD_POPULATIONS)[number];

export const STANDARD_POPULATION_LABELS: Readonly<Record<StandardPopulation, string>> = {
  'esp-2013': '2013 European Standard Population',
  other: 'Other',
};

/** The unit as the public reads it beside a value: null when the values have none. */
export function unitLabel(unit: { id: string; name: string }, other: string | null): string | null {
  if (unit.id === UNITS.noUnit.id) return null;
  return unit.id === UNITS.other.id && other !== null ? other : unit.name;
}

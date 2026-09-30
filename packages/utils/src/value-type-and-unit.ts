/**
 * The value types whose ids the code behaves on. Every value type is a core data row, listed
 * in `value-types.json` in @fphd/db.
 */
export const VALUE_TYPE_IDS = {
  directlyStandardisedRate: '01a0d8a5-3ca2-7315-bfca-96c9664c846c',
  indirectlyStandardisedProportion: '01a0d8a5-3ca2-7315-bfca-96cc2dc711c3',
  indirectlyStandardisedRatio: '01a0d8a5-3ca2-7315-bfca-96cda63ea940',
} as const;

/** The units whose ids the code behaves on; every unit is a core data row, as value types are. */
export const UNIT_IDS = {
  noUnit: '01a0d8a5-3ca2-7315-bfca-96e4a96bfc8e',
  // Named by the publisher in `unit_detail`.
  other: '01a0d8a5-3ca2-7315-bfca-96e5cee57158',
} as const;

export const UNIT_DETAIL_MAX_LENGTH = 100;

/** The value types standardised against a reference population the publisher names. */
export const INDIRECTLY_STANDARDISED_VALUE_TYPE_IDS: readonly string[] = [
  VALUE_TYPE_IDS.indirectlyStandardisedProportion,
  VALUE_TYPE_IDS.indirectlyStandardisedRatio,
];

/** How a value type is standardised, which decides what the form asks of its population. */
export function standardisationOf(valueTypeId: string): 'direct' | 'indirect' | null {
  if (valueTypeId === VALUE_TYPE_IDS.directlyStandardisedRate) return 'direct';
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
export function unitLabel(
  unit: { id: string; name: string },
  detail: string | null,
): string | null {
  if (unit.id === UNIT_IDS.noUnit) return null;
  return unit.id === UNIT_IDS.other && detail !== null ? detail : unit.name;
}

import { readFileSync } from 'node:fs';

import { UNIT_IDS } from '@fphd/utils/value-type-and-unit';

const coreDataDir = new URL('../../../../packages/db-operations/data/', import.meta.url);

function idsFromJson(file: string): Record<string, string> {
  const rows = JSON.parse(readFileSync(new URL(file, coreDataDir), 'utf8')) as {
    id: string;
    name: string;
  }[];
  return Object.fromEntries(rows.map((row) => [row.name, row.id]));
}

const valueTypeIdsByName: Record<string, string> = idsFromJson('value-types.json');
const unitIdsByName: Record<string, string> = idsFromJson('units.json');

export const VALUE_TYPES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.keys(valueTypeIdsByName).map((name) => [name, name])),
  'Slope Index of Inequality': 'Slope index of inequality',
  'Relative Index of Inequality': 'Relative index of inequality',
  Number: 'Count',
  'Months life lost': 'Count',
  'Rate ratio': 'Ratio',
  'Indirectly standardised rate': 'Indirectly standardised proportion',
  'Unknown value type 21': 'Gap',
};

export const UNITS: Readonly<Record<string, string>> = {
  Percent: '%',
  'per 100': 'per 100',
  'per 1,000': 'per 1,000',
  'per 10,000': 'per 10,000',
  'per 100,000': 'per 100,000',
  'per 1,000,000': 'per 1,000,000',
  Minutes: 'minutes',
  Days: 'days',
  Years: 'years',
  '£': '£',
  '£ per capita': '£ per capita',
  'No unit': 'No unit',
};

export const UNIT_PLACEHOLDERS: Readonly<Record<string, string>> = {
  'Unknown unit 54': 'admissions',
  'Unknown unit 56': '£',
  'Unknown unit 57': 'per 1,000,000',
  'Unknown unit 58': 'Minutes',
  'Unknown unit 59': 'per 100,000 bed-days',
  'Unknown unit 60': 'per 100',
  'Unknown unit 61': 'litres per adult',
  'Unknown unit 63': 'µg/m-3 (micrograms per cubic meter)',
  'Unknown unit 65': 'per 100 procedures',
  'Unknown unit 66': 'Score',
  'Unknown unit 67': 'Count',
  'Unknown unit 68': 'Percentage points',
  'Unknown unit 71': 'per 1,000, per day ',
  'Unknown unit 72': 'per 100,000 smoking population aged 18+',
  'Unknown unit 73': 'per re-offender',
  'Unknown unit 74': 'per 1,000,000,000 vehicle miles',
  'Unknown unit 75': 'Persons per km2',
  'Unknown unit 76': 'Centimetre',
};

export const UNIT_NAMES_BY_LABEL: Readonly<Record<string, string>> = {
  '%': 'Percent',
  'per 100': 'per 100',
  'per 1,000': 'per 1,000',
  'per 10,000': 'per 10,000',
  'per 100,000': 'per 100,000',
  'per 1,000,000': 'per 1,000,000',
  min: 'Minutes',
  Days: 'Days',
  Years: 'Years',
  '£ per capita': '£ per capita',
  'No unit': 'No unit',
};

const UNKNOWN_UNIT_PREFIX = 'Unknown unit ';

export function valueTypeId(name: string): string {
  const serviceName = VALUE_TYPES[name];
  if (serviceName === undefined)
    throw new Error(`No value type for the Fingertips value type ${JSON.stringify(name)}`);
  const id = valueTypeIdsByName[serviceName];
  if (id === undefined)
    throw new Error(`No value type for the Fingertips value type ${JSON.stringify(name)}`);
  return id;
}

export function unitValues(name: string): { unit_id: string; unit_detail: string | null } {
  const resolved = UNIT_PLACEHOLDERS[name] ?? name;
  if (resolved in UNITS) {
    const unitName = UNITS[resolved] as string;
    const id = unitIdsByName[unitName];
    if (id === undefined)
      throw new Error(`No unit for the Fingertips unit ${JSON.stringify(name)}`);
    return { unit_id: id, unit_detail: null };
  }
  const trimmed = resolved.replace(/ +$/g, '').replace(/^ +/g, '');
  if (!trimmed || trimmed.startsWith(UNKNOWN_UNIT_PREFIX)) {
    throw new Error(`No unit for the Fingertips unit ${JSON.stringify(name)}`);
  }
  return { unit_id: UNIT_IDS.other, unit_detail: trimmed };
}

export function unitNameForLabel(label: string): string {
  const name = UNIT_NAMES_BY_LABEL[label];
  if (name === undefined)
    throw new Error(`No Fingertips unit name known for the unit label ${JSON.stringify(label)}`);
  return name;
}

export function unknownValueTypes(names: Iterable<string>): string[] {
  const result: string[] = [];
  for (const name of names) {
    try {
      valueTypeId(name);
    } catch {
      result.push(name);
    }
  }
  return result.sort();
}

export function unknownUnits(names: Iterable<string>): string[] {
  const result: string[] = [];
  for (const name of names) {
    try {
      unitValues(name);
    } catch {
      result.push(name);
    }
  }
  return result.sort();
}

import { tidyName } from '@fphd/utils/tidy-name';
import { describe, expect, it } from 'vitest';

import { readSeedTable } from './seed-csv.testing.ts';

/** Uploaded data is matched to these names tidied, so each must be tidy and match one row. */
const types = readSeedTable('dimension_type');
const values = readSeedTable('dimension_value');
const notes = readSeedTable('note_type');

function untidy(names: string[]): string[] {
  return names.filter((name) => tidyName(name) !== name);
}

function repeated(keys: string[]): string[] {
  return keys.filter((key, index) => keys.indexOf(key) !== index);
}

describe('the committed seed', () => {
  it('holds every dimension type, dimension value and note type name in its tidy form', () => {
    expect(untidy(types.map((row) => row.name ?? ''))).toEqual([]);
    expect(untidy(values.map((row) => row.name ?? ''))).toEqual([]);
    expect(untidy(notes.map((row) => row.text ?? ''))).toEqual([]);
  });

  it('gives no two dimension types, values of one type or note types the same name', () => {
    expect(repeated(types.map((row) => row.name ?? ''))).toEqual([]);
    expect(repeated(values.map((row) => `${row.dimension_type_id} ${row.name}`))).toEqual([]);
    expect(repeated(notes.map((row) => row.text ?? ''))).toEqual([]);
  });
});

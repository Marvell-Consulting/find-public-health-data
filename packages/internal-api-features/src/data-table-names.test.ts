import { describe, expect, it } from 'vitest';

import { AMBIGUOUS, categoryKey, nameIndex, nameKey } from './data-table-names.ts';

describe('nameKey', () => {
  it('tidies the spaces and folds the case', () => {
    expect(nameKey('  All   AGES ')).toBe('all ages');
  });
});

describe('categoryKey', () => {
  it('keeps the type and the name apart', () => {
    expect(categoryKey('Ethnic groups', 'White')).not.toBe(categoryKey('Ethnic', 'groups White'));
  });
});

describe('nameIndex', () => {
  it('indexes each id by its key', () => {
    expect(nameIndex([['female', 'id-1']])).toEqual(new Map([['female', 'id-1']]));
  });

  it('marks a key two ids share, keeping neither', () => {
    expect(
      nameIndex([
        [nameKey('Female'), 'id-1'],
        [nameKey('FEMALE'), 'id-2'],
      ]).get('female'),
    ).toBe(AMBIGUOUS);
  });

  it('keeps one id given twice', () => {
    expect(
      nameIndex([
        ['female', 'id-1'],
        ['female', 'id-1'],
      ]).get('female'),
    ).toBe('id-1');
  });
});

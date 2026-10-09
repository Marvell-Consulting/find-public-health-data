import { describe, expect, it } from 'vitest';

import { readHeader } from './data-table-columns.ts';

describe('readHeader', () => {
  it('places each column, matching headings whatever their case and surrounding spaces', () => {
    expect(readHeader([' Area_Code', 'PERIOD_START ', 'period_end', 'value', 'Sex'])).toEqual({
      positions: { area_code: 0, period_start: 1, period_end: 2, value: 3, sex: 4 },
      columnCount: 5,
      findings: [],
    });
  });

  it('accepts every column in the format', () => {
    const header = [
      'value_note',
      'category',
      'category_type',
      'age',
      'sex',
      'upper_ci_998',
      'lower_ci_998',
      'upper_ci_95',
      'lower_ci_95',
      'denominator',
      'count',
      'value',
      'period_end',
      'period_start',
      'area_code',
    ];

    expect(readHeader(header).findings).toEqual([]);
  });

  it('names each required column that is missing', () => {
    expect(readHeader(['area_code', 'value']).findings).toEqual([
      { code: 'missing_column', item: 'period_start' },
      { code: 'missing_column', item: 'period_end' },
    ]);
  });

  it('refuses a heading not in the format, including an empty one', () => {
    expect(
      readHeader(['area_code', 'period_start', 'period_end', 'value', 'Period', '']).findings,
    ).toEqual([
      { code: 'unrecognised_columns', item: 'period' },
      { code: 'unrecognised_columns', item: '' },
    ]);
  });

  it('refuses a column given twice, once however often it repeats', () => {
    expect(
      readHeader(['area_code', 'period_start', 'period_end', 'value', 'Value', 'value']).findings,
    ).toEqual([{ code: 'repeated_columns', item: 'value' }]);
  });

  it.each([['category_type'], ['category']])('refuses %s without its partner', (column) => {
    expect(
      readHeader(['area_code', 'period_start', 'period_end', 'value', column]).findings,
    ).toEqual([{ code: 'unpaired_category' }]);
  });

  it('places the columns of a refused header, each where it first appears', () => {
    expect(readHeader(['Area', 'value', 'area_code', 'value'])).toMatchObject({
      positions: { value: 1, area_code: 2 },
      columnCount: 4,
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  ENGLAND,
  FEMALE,
  LEEDS,
  references,
  SMALL_COUNT,
  UNDER_75,
  WHITE,
} from './data-table.testing.ts';
import { readHeader } from './data-table-columns.ts';
import { isIsoDate, isNumber, readRow } from './data-table-rows.ts';

const HEADER = [
  'area_code',
  'period_start',
  'period_end',
  'value',
  'count',
  'denominator',
  'lower_ci_95',
  'upper_ci_95',
  'lower_ci_998',
  'upper_ci_998',
  'sex',
  'age',
  'category_type',
  'category',
  'value_note',
];

const header = readHeader(HEADER);
if (!header.ok) throw new Error('the test header is refused');

type Cells = Partial<Record<(typeof HEADER)[number], string>>;

const VALID: Cells = {
  area_code: 'E92000001',
  period_start: '2019-04-01',
  period_end: '2020-03-31',
};

/** A row of the full header, from the cells given. */
function read(cells: Cells, line = 2) {
  return readRow(
    HEADER.map((column) => cells[column] ?? ''),
    header.ok ? header.positions : {},
    references,
    line,
  );
}

describe('isNumber', () => {
  it.each(['0', '83.8', '-1', '-0.25', '1.5e3', '2E-4', '1234567'])('accepts %s', (text) => {
    expect(isNumber(text)).toBe(true);
  });

  it.each(['1,234', '83.8%', 'NaN', 'Infinity', '1e999', '+1', '.5', '5.', '1 234', '0x10', ''])(
    'refuses %s',
    (text) => {
      expect(isNumber(text)).toBe(false);
    },
  );
});

describe('isIsoDate', () => {
  it.each(['2019-04-01', '2024-02-29', '1999-12-31'])('accepts %s', (text) => {
    expect(isIsoDate(text)).toBe(true);
  });

  it.each(['2019/20', '01/04/2019', '2023-02-29', '2019-13-01', '2019-4-1', '20190401'])(
    'refuses %s',
    (text) => {
      expect(isIsoDate(text)).toBe(false);
    },
  );
});

describe('readRow', () => {
  it('reads a full row into ids, dates and the numbers as written', () => {
    expect(
      read(
        {
          area_code: 'E08000035',
          period_start: '2019-04-01',
          period_end: '2020-03-31',
          value: '83.8',
          count: '1234',
          denominator: '56789',
          lower_ci_95: '83.7',
          upper_ci_95: '83.9',
          lower_ci_998: '83.6',
          upper_ci_998: '84.0',
          sex: 'Female',
          age: '<75 yrs',
          category_type: 'Ethnic groups',
          category: 'White',
          value_note: 'Value suppressed for disclosure control',
        },
        7,
      ),
    ).toEqual({
      ok: true,
      row: {
        line: 7,
        areaId: LEEDS,
        fromDate: '2019-04-01',
        toDate: '2020-03-31',
        value: '83.8',
        count: '1234',
        denominator: '56789',
        lower_ci_95: '83.7',
        upper_ci_95: '83.9',
        lower_ci_998: '83.6',
        upper_ci_998: '84.0',
        sexId: FEMALE,
        ageId: UNDER_75,
        categoryId: WHITE,
        noteTypeId: SMALL_COUNT,
      },
    });
  });

  it('stores empty cells as nothing, an empty value included', () => {
    expect(read(VALID)).toEqual({
      ok: true,
      row: {
        line: 2,
        areaId: ENGLAND,
        fromDate: '2019-04-01',
        toDate: '2020-03-31',
        value: null,
        count: null,
        denominator: null,
        lower_ci_95: null,
        upper_ci_95: null,
        lower_ci_998: null,
        upper_ci_998: null,
        sexId: null,
        ageId: null,
        categoryId: null,
        noteTypeId: null,
      },
    });
  });

  it('trims every cell and tidies the spaces inside names', () => {
    const reading = read({
      area_code: ' E92000001 ',
      period_start: ' 2019-04-01',
      period_end: '2020-03-31 ',
      value: ' 83.8 ',
      category_type: ' Ethnic   groups ',
      category: 'White ',
      value_note: 'Value  suppressed for disclosure control',
    });

    expect(reading).toMatchObject({
      ok: true,
      row: { areaId: ENGLAND, value: '83.8', categoryId: WHITE, noteTypeId: SMALL_COUNT },
    });
  });

  it('stores the totals, Persons and All ages, without that dimension', () => {
    expect(read({ ...VALID, sex: 'Persons', age: 'All ages' })).toMatchObject({
      ok: true,
      row: { sexId: null, ageId: null },
    });
  });

  it('matches names in the case reference data gives them', () => {
    expect(read({ ...VALID, sex: 'female' })).toEqual({
      ok: false,
      findings: [{ code: 'unmatched_sexes', item: 'female' }],
    });
  });

  it('refuses a row with more or fewer cells than headings and reads nothing else', () => {
    expect(
      readRow(['E92000001', '2019-04-01'], header.ok ? header.positions : {}, references, 4),
    ).toEqual({ ok: false, findings: [{ code: 'wrong_cell_count', item: '4' }] });
  });

  it.each([['area_code'], ['period_start'], ['period_end']])(
    'refuses a row with no %s, without checking the period',
    (column) => {
      expect(read({ ...VALID, [column]: ' ' }, 5)).toEqual({
        ok: false,
        findings: [{ code: 'missing_cells', item: '5' }],
      });
    },
  );

  it('names an area code no current area has', () => {
    expect(read({ ...VALID, area_code: 'E99999999' })).toEqual({
      ok: false,
      findings: [{ code: 'unmatched_area_codes', item: 'E99999999' }],
    });
  });

  it.each([
    ['a label', '2019/20', '2019/20'],
    ['a date that does not exist', '2019-02-30', '2019-03-31'],
    ['a period ending before it starts', '2020-04-01', '2020-03-31'],
  ])('refuses %s as a period', (_case, start, end) => {
    expect(read({ ...VALID, period_start: start, period_end: end }, 6)).toEqual({
      ok: false,
      findings: [{ code: 'invalid_periods', item: '6' }],
    });
  });

  it('accepts a period of one day', () => {
    expect(read({ ...VALID, period_start: '2020-03-31', period_end: '2020-03-31' }).ok).toBe(true);
  });

  it('refuses a row once whatever number of its numbers cannot be read', () => {
    expect(read({ ...VALID, value: '1,234', count: 'n/a' }, 8)).toEqual({
      ok: false,
      findings: [{ code: 'invalid_numbers', item: '8' }],
    });
  });

  it.each([
    ['sex', 'Unknown', 'unmatched_sexes'],
    ['age', '200+ yrs', 'unmatched_ages'],
    ['value_note', 'Made up', 'unmatched_value_notes'],
  ])('names a %s that matches no reference data', (column, value, code) => {
    expect(read({ ...VALID, [column]: value })).toEqual({
      ok: false,
      findings: [{ code, item: value }],
    });
  });

  it.each([
    ['an unknown category', 'Ethnic groups', 'Purple', 'Ethnic groups: Purple'],
    ['an unknown category type', 'Hair colour', 'White', 'Hair colour: White'],
    ['sex, which has its own column', 'Sex', 'Female', 'Sex: Female'],
  ])('names %s', (_case, categoryType, category, item) => {
    expect(read({ ...VALID, category_type: categoryType, category })).toEqual({
      ok: false,
      findings: [{ code: 'unmatched_categories', item }],
    });
  });

  it.each([
    ['category_type', 'Ethnic groups'],
    ['category', 'White'],
  ])('refuses a row with a %s and not its partner', (column, value) => {
    expect(read({ ...VALID, [column]: value }, 9)).toEqual({
      ok: false,
      findings: [{ code: 'unpaired_category', item: '9' }],
    });
  });

  it('reports everything wrong with a row at once', () => {
    expect(
      read({ ...VALID, area_code: 'X', value: 'high', sex: 'Neither', value_note: 'Odd' }, 3),
    ).toEqual({
      ok: false,
      findings: [
        { code: 'unmatched_area_codes', item: 'X' },
        { code: 'invalid_numbers', item: '3' },
        { code: 'unmatched_sexes', item: 'Neither' },
        { code: 'unmatched_value_notes', item: 'Odd' },
      ],
    });
  });
});

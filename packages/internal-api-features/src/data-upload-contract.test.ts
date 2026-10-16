import { describe, expect, it } from 'vitest';

import {
  DATA_TABLE_MAX_BYTES,
  DATA_TABLE_MESSAGES,
  dataTableFileRefusal,
  dataTableNameRefusal,
} from './data-upload-contract.ts';

describe('dataTableNameRefusal', () => {
  it.each([[undefined], ['']])('asks for a file when the name is %j', (name) => {
    expect(dataTableNameRefusal(name)).toBe(DATA_TABLE_MESSAGES.missing);
  });

  it.each([['data.xlsx'], ['data.csv.txt'], ['csv']])('refuses %s as not a CSV', (name) => {
    expect(dataTableNameRefusal(name)).toBe(DATA_TABLE_MESSAGES.notCsv);
  });

  it.each([['data.csv'], ['DATA.CSV'], ['life expectancy.Csv']])('accepts %s', (name) => {
    expect(dataTableNameRefusal(name)).toBeUndefined();
  });
});

describe('dataTableFileRefusal', () => {
  it.each([
    ['no file', { name: '', size: 0 }, DATA_TABLE_MESSAGES.missing],
    ['a file that is not a CSV', { name: 'data.xlsx', size: 10 }, DATA_TABLE_MESSAGES.notCsv],
    ['an empty file', { name: 'data.csv', size: 0 }, DATA_TABLE_MESSAGES.empty],
    [
      'a file over the limit',
      { name: 'data.csv', size: DATA_TABLE_MAX_BYTES + 1 },
      DATA_TABLE_MESSAGES.tooLarge,
    ],
  ])('refuses %s', (_case, file, message) => {
    expect(dataTableFileRefusal(file)).toBe(message);
  });

  it('accepts a CSV of the largest size there is room for', () => {
    expect(dataTableFileRefusal({ name: 'data.csv', size: DATA_TABLE_MAX_BYTES })).toBeUndefined();
  });

  it('names the file before measuring it, as the API does', () => {
    expect(dataTableFileRefusal({ name: 'data.xlsx', size: 0 })).toBe(DATA_TABLE_MESSAGES.notCsv);
  });
});

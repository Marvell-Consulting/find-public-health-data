import { describe, expect, it } from 'vitest';

import { dataTablePageQuerySchema } from './data-table-check-contract.ts';

describe('dataTablePageQuerySchema', () => {
  it('takes the first page of 10 rows when neither is given', () => {
    expect(dataTablePageQuerySchema.parse({})).toEqual({ page: 1, rowsPerPage: 10 });
  });

  it.each([
    ['10', 10],
    ['25', 25],
    ['50', 50],
  ])('reads %s rows per page', (rowsPerPage, expected) => {
    expect(dataTablePageQuerySchema.parse({ page: '4', rowsPerPage })).toEqual({
      page: 4,
      rowsPerPage: expected,
    });
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { page: 'x' },
    { page: '1e300' },
    { page: ['1', '2'] },
    { rowsPerPage: '20' },
    { rowsPerPage: '' },
  ])('refuses %j', (query) => {
    expect(dataTablePageQuerySchema.safeParse(query).success).toBe(false);
  });
});

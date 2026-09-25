import { describe, expect, it } from 'vitest';

import { isDayOfMonth, YEAR_TYPES, yearTypeLabel } from './period-type.ts';

describe('isDayOfMonth', () => {
  it.each([
    [31, 1],
    [29, 2],
    [30, 4],
    [31, 12],
    [1, 1],
  ])('accepts %i of month %i', (day, month) => {
    expect(isDayOfMonth(day, month)).toBe(true);
  });

  it.each([
    [30, 2],
    [31, 4],
    [31, 11],
    [0, 1],
    [32, 1],
    [1, 0],
    [1, 13],
    [1.5, 1],
  ])('refuses %d of month %d', (day, month) => {
    expect(isDayOfMonth(day, month)).toBe(false);
  });
});

describe('yearTypeLabel', () => {
  const specified = YEAR_TYPES.specifiedEndDate;

  it('is null without a year type', () => {
    expect(yearTypeLabel(null, null)).toBeNull();
  });

  it("is a year type's name when it has no end date", () => {
    expect(yearTypeLabel(YEAR_TYPES.financial, null)).toBe('Financial');
  });

  it.each([
    [31, 7, 'August to July'],
    [30, 6, 'July to June'],
    [30, 9, 'October to September'],
    [31, 12, 'January to December'],
    [31, 3, 'April to March'],
    [28, 2, 'March to February'],
    [29, 2, 'March to February'],
  ])(
    'names the months of a year ending on the last day of a month (%i/%i)',
    (day, month, label) => {
      expect(yearTypeLabel(specified, { day, month })).toBe(label);
    },
  );

  it.each([
    [15, 11, 'Year ending 15 November'],
    [30, 7, 'Year ending 30 July'],
    [1, 1, 'Year ending 1 January'],
  ])('names the date of a year ending within a month (%i/%i)', (day, month, label) => {
    expect(yearTypeLabel(specified, { day, month })).toBe(label);
  });
});

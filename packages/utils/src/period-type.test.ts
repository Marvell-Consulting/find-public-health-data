import { describe, expect, it } from 'vitest';

import { isDayOfMonth, publicYearType, YEAR_TYPES, yearTypeValuesLabelled } from './period-type.ts';

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

  it('accepts 29 February only in a leap year when given the year', () => {
    expect(isDayOfMonth(29, 2, 2028)).toBe(true);
    expect(isDayOfMonth(29, 2, 2027)).toBe(false);
    expect(isDayOfMonth(29, 2, 2100)).toBe(false);
  });

  it.each([2028.5, -2028, 0, 99, 10000])('refuses a year of %s', (year) => {
    expect(isDayOfMonth(1, 1, year)).toBe(false);
  });
});

describe('publicYearType', () => {
  const { academic, calendar, financial, rolling, specifiedEndDate } = YEAR_TYPES;

  it.each([
    ['Calendar', calendar],
    ['Financial', financial],
    ['Academic', academic],
    ['Rolling', rolling],
  ])('labels %s by its own name', (label, yearType) => {
    expect(publicYearType(yearType.id, null)).toEqual({ id: yearType.id, label });
  });

  it.each([
    [31, 3, financial],
    [31, 12, calendar],
    [31, 8, academic],
  ])('is the named year type a year ending %i/%i ends with', (day, month, yearType) => {
    expect(publicYearType(specifiedEndDate.id, { day, month })).toEqual({
      id: yearType.id,
      label: yearType.name,
    });
  });

  it.each([
    [31, 7, 'August to July'],
    [30, 6, 'July to June'],
    [30, 9, 'October to September'],
    [31, 1, 'February to January'],
    [28, 2, 'March to February'],
    [29, 2, 'March to February'],
  ])(
    'names the months of a year ending on the last day of a month (%i/%i)',
    (day, month, label) => {
      expect(publicYearType(specifiedEndDate.id, { day, month })).toEqual({
        id: specifiedEndDate.id,
        label,
      });
    },
  );

  it.each([
    [15, 11, 'Year ending 15 November'],
    [30, 7, 'Year ending 30 July'],
    [30, 3, 'Year ending 30 March'],
    [1, 1, 'Year ending 1 January'],
  ])('names the date of a year ending within a month (%i/%i)', (day, month, label) => {
    expect(publicYearType(specifiedEndDate.id, { day, month }).label).toBe(label);
  });

  it('refuses an id that is no year type', () => {
    expect(() => publicYearType('01a0d88c-0000-7000-8000-000000000000', null)).toThrow(
      'Not a year type',
    );
  });
});

describe('yearTypeValuesLabelled', () => {
  const { academic, calendar, financial, rolling, specifiedEndDate } = YEAR_TYPES;
  const endingOn = (day: number, month: number) => ({
    yearTypeId: specifiedEndDate.id,
    yearEnd: { day, month },
  });

  it.each([
    ['Financial', financial, [31, 3]],
    ['Calendar', calendar, [31, 12]],
    ['Academic', academic, [31, 8]],
  ] as const)('finds %s and the year ending on its last day', (label, yearType, [day, month]) => {
    expect(yearTypeValuesLabelled(label)).toEqual([
      { yearTypeId: yearType.id, yearEnd: null },
      endingOn(day, month),
    ]);
  });

  it.each([
    ['April to March', 'Financial'],
    ['January to December', 'Calendar'],
    ['September to August', 'Academic'],
  ])('reads %s as %s', (months, named) => {
    expect(yearTypeValuesLabelled(months)).toEqual(yearTypeValuesLabelled(named));
  });

  it('finds rolling years', () => {
    expect(yearTypeValuesLabelled('Rolling')).toEqual([{ yearTypeId: rolling.id, yearEnd: null }]);
  });

  it('finds years ending 28 and 29 February by the one label', () => {
    expect(yearTypeValuesLabelled('March to February')).toEqual([endingOn(28, 2), endingOn(29, 2)]);
  });

  it('finds a year ending within a month by its date', () => {
    expect(yearTypeValuesLabelled('Year ending 15 November')).toEqual([endingOn(15, 11)]);
  });

  it.each(['Ending a specified date', 'November-November', 'Financial year end point', ''])(
    'finds nothing for %j, which no year is labelled',
    (label) => {
      expect(yearTypeValuesLabelled(label)).toEqual([]);
    },
  );
});

import { describe, expect, it } from 'vitest';

import {
  areaTypeHierarchyType,
  areaTypeName,
  normalizeAreaTypeName,
  preferredAreaOrder,
  stripLeadingN,
} from './geography.ts';

describe('stripLeadingN', () => {
  it('strips a leading lowercase n', () => {
    expect(stripLeadingN('nSTP_1')).toBe('STP_1');
    expect(stripLeadingN('nE12000001')).toBe('E12000001');
  });

  it('strips a leading uppercase N (MSSQL LIKE is case-insensitive)', () => {
    expect(stripLeadingN('N84027')).toBe('84027');
    expect(stripLeadingN('N81001')).toBe('81001');
  });

  it('leaves codes not starting with n or N unchanged', () => {
    expect(stripLeadingN('E12000001')).toBe('E12000001');
    expect(stripLeadingN('A81001')).toBe('A81001');
    expect(stripLeadingN('')).toBe('');
  });
});

describe('areaTypeName', () => {
  it('appends [id] suffix for duplicate names', () => {
    expect(areaTypeName('GPs', 7, true)).toBe('GPs [7]');
  });

  it('leaves unique names unchanged', () => {
    expect(areaTypeName('Regions (statistical)', 6, false)).toBe('Regions (statistical)');
  });
});

describe('areaTypeHierarchyType', () => {
  it('returns NHS for hard-coded area type ids', () => {
    expect(areaTypeHierarchyType(null, 7)).toBe('NHS');
    expect(areaTypeHierarchyType('', 66)).toBe('NHS');
    expect(areaTypeHierarchyType('Administrative', 153)).toBe('NHS');
  });

  it('returns NHS when AreaTypeClass contains NHS', () => {
    expect(areaTypeHierarchyType('NHS Region', 200)).toBe('NHS');
    expect(areaTypeHierarchyType('CCG areas', 200)).toBe('NHS');
    expect(areaTypeHierarchyType('ICB boundary', 200)).toBe('NHS');
  });

  it('returns Administrative for non-NHS class', () => {
    expect(areaTypeHierarchyType('Local authority', 200)).toBe('Administrative');
    expect(areaTypeHierarchyType(null, 200)).toBe('Administrative');
  });
});

describe('normalizeAreaTypeName', () => {
  it('strips trailing spaces to match SQL Server trailing-space-ignoring collation', () => {
    expect(normalizeAreaTypeName('GPs ')).toBe('gps');
    expect(normalizeAreaTypeName('GPs')).toBe('gps');
  });

  it('lowercases to match SQL Server case-insensitive collation', () => {
    expect(normalizeAreaTypeName('Regions')).toBe('regions');
    expect(normalizeAreaTypeName('REGIONS')).toBe('regions');
  });

  it('makes trailing-space variant collide with canonical name', () => {
    expect(normalizeAreaTypeName('Counties & UAs')).toBe(normalizeAreaTypeName('Counties & UAs '));
  });
});

describe('preferredAreaOrder', () => {
  it('prefers the original Scottish and Welsh codes regardless of scan order', () => {
    const rows = ['nW1', 'nS1', 'W1', 'S1'].map((AreaCode) => ({ AreaCode }));
    const expected = ['S1', 'W1', 'nS1', 'nW1'];
    expect(preferredAreaOrder(rows).map((row) => row.AreaCode)).toEqual(expected);
    expect(preferredAreaOrder([...rows].reverse()).map((row) => row.AreaCode)).toEqual(expected);
  });
});

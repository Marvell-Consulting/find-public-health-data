import { describe, expect, it } from 'vitest';

import { searchPattern } from './search-pattern.ts';

describe('searchPattern', () => {
  it('ignores surrounding spaces and treats punctuation as literal text', () => {
    const pattern = searchPattern('  (care)+  ');
    expect(pattern?.test('Health (CARE)+ services')).toBe(true);
    expect(pattern?.test('Health care services')).toBe(false);
  });

  it.each([
    ['İ', 'i', false],
    ['İ', 'İ', true],
    ['K', 'k', true],
    ['ς', 'σ', true],
    ['𐐀', '𐐨', true],
  ])('matches %s against %s consistently with Unicode case folding', (text, query, matches) => {
    expect(searchPattern(query)?.test(text)).toBe(matches);
  });

  it('returns no pattern for an empty or whitespace-only query', () => {
    expect(searchPattern('')).toBeUndefined();
    expect(searchPattern('  ')).toBeUndefined();
  });
});

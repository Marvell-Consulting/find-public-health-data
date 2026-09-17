import { describe, expect, it } from 'vitest';

import { SLUG_PATTERN, slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Under 75 mortality rate from all causes', 'under-75-mortality-rate-from-all-causes'],
    ['Diabetes: QOF prevalence', 'diabetes-qof-prevalence'],
    ['% resident in each deprivation quintile', 'resident-in-each-deprivation-quintile'],
    ['Emergency admissions (0–4 years)', 'emergency-admissions-04-years'],
    ['  Leading   and trailing  ', 'leading-and-trailing'],
    ['Already-hyphenated — twice', 'already-hyphenated-twice'],
    ['Tabs\tand\nnewlines', 'tabs-and-newlines'],
  ])('slugifies %s', (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });

  it('suffixes a title that would otherwise read as an indicator number', () => {
    expect(slugify('2030')).toBe('2030-indicator');
  });

  it('leaves a slug that merely contains digits alone', () => {
    expect(slugify('2030 target')).toBe('2030-target');
  });

  it('does not cap the length', () => {
    expect(slugify('a '.repeat(200).trim())).toHaveLength(399);
  });

  it('gives back nothing a slug can be made of as the empty string', () => {
    expect(slugify('!!! ???')).toBe('');
  });

  it.each([
    'Under 75 mortality rate from all causes',
    'Diabetes: QOF prevalence',
    '% resident in each deprivation quintile',
    '2030',
  ])('produces a slug matching the shared pattern for %s', (title) => {
    expect(slugify(title)).toMatch(SLUG_PATTERN);
  });
});

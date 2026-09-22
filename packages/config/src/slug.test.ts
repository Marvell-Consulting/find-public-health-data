import { describe, expect, it } from 'vitest';

import {
  isReservedSlug,
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
  slugify,
  slugProblem,
} from './slug.ts';

describe('slugify', () => {
  it.each([
    ['Under 75 mortality rate from all causes', 'under-75-mortality-rate-from-all-causes'],
    ['Diabetes: QOF prevalence', 'diabetes-qof-prevalence'],
    ['Life expectancy at birth', 'life-expectancy-at-birth'],
    ['Under-75 mortality', 'under-75-mortality'],
    ['% of people in each quintile', 'of-people-in-each-quintile'],
    ['Emergency admissions (0–4 years)', 'emergency-admissions-0-4-years'],
    ['Palliative/supportive care: QOF prevalence', 'palliative-supportive-care-qof-prevalence'],
    ['Opiate and/or crack — estimated', 'opiate-and-or-crack-estimated'],
    ['piperacillin\\tazobactam', 'piperacillin-tazobactam'],
    ["Children's dental health", 'childrens-dental-health'],
    ['  leading and trailing  ', 'leading-and-trailing'],
    ['tabs\tand\nnewlines', 'tabs-and-newlines'],
    ['already-a-slug', 'already-a-slug'],
    ['--dashes--everywhere--', 'dashes-everywhere'],
  ])('turns %j into %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('folds accents to their plain letters', () => {
    expect(slugify('Café résumé naïve')).toBe('cafe-resume-naive');
  });

  it('drops characters with no plain-letter form rather than transliterating them', () => {
    expect(slugify('Ω temperature')).toBe('temperature');
  });

  it('yields a slug that matches the shared pattern', () => {
    expect(SLUG_PATTERN.test(slugify('Mortality rate: deaths involving diabetes'))).toBe(true);
  });

  it('yields the empty string when nothing usable is left', () => {
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('')).toBe('');
  });

  describe('the length limit', () => {
    it('leaves a name at the limit alone', () => {
      const name = `${'word '.repeat(39)}xxxxx`.trim();
      const slug = slugify(name);

      expect(slug).toHaveLength(SLUG_MAX_LENGTH);
      expect(slug.endsWith('word-xxxxx')).toBe(true);
    });

    it('cuts on a word boundary, dropping the word that would overrun', () => {
      const slug = slugify(`${'word '.repeat(40)}overrun`);

      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
      expect(slug.endsWith('-word')).toBe(true);
      expect(slug).not.toContain('overrun');
    });

    it('cuts a single overlong word short, having no boundary to cut on', () => {
      const slug = slugify('a'.repeat(250));

      expect(slug).toBe('a'.repeat(SLUG_MAX_LENGTH));
    });

    it('never ends on a hyphen', () => {
      const slug = slugify(`${'ab '.repeat(70)}tail`);

      expect(slug.endsWith('-')).toBe(false);
      expect(SLUG_PATTERN.test(slug)).toBe(true);
    });
  });
});

describe('isReservedSlug', () => {
  it.each(RESERVED_SLUGS)('reserves %s, which is a route of its own', (slug) => {
    expect(isReservedSlug(slug)).toBe(true);
  });

  it('leaves an ordinary slug alone', () => {
    expect(isReservedSlug('life-expectancy-at-birth')).toBe(false);
  });
});

describe('slugProblem', () => {
  it('reports nothing for a name that yields a usable slug', () => {
    expect(slugProblem('Life expectancy at birth')).toBeUndefined();
  });

  it.each(['', '!!!', '   ', '???'])('reports %j as empty', (name) => {
    expect(slugProblem(name)).toBe('empty');
  });

  it.each(['2024', '108', '  90366  '])(
    'reports %j as digits, which reads as a short id',
    (name) => {
      expect(slugProblem(name)).toBe('digits');
    },
  );

  it.each(['Search', 'facets', 'Compare!'])('reports %j as reserved', (name) => {
    expect(slugProblem(name)).toBe('reserved');
  });

  it('accepts a name whose slug only starts with digits', () => {
    expect(slugProblem('2024 admissions')).toBeUndefined();
  });
});

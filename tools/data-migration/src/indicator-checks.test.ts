import { describe, expect, it } from 'vitest';

import { checkSlugs, parseIndicatorIds } from './indicator-checks.ts';

describe('checkSlugs', () => {
  it('passes when all names produce distinct slugs', () => {
    expect(() =>
      checkSlugs([
        { id: 1, name: 'Life expectancy at birth' },
        { id: 2, name: 'Infant mortality rate' },
        { id: 3, name: 'Cancer screening coverage' },
      ]),
    ).not.toThrow();
  });

  it('throws when two names slugify to the same slug', () => {
    expect(() =>
      checkSlugs([
        { id: 90366, name: 'Life expectancy at birth' },
        { id: 93283, name: 'Life expectancy at birth' },
      ]),
    ).toThrow('life-expectancy-at-birth');
  });

  it('names all colliding source ids in the error', () => {
    expect(() =>
      checkSlugs([
        { id: 1, name: 'Foo bar' },
        { id: 2, name: 'Foo  bar' },
      ]),
    ).toThrow('1');
  });

  it('reports each collision pair with source id and quoted name', () => {
    let message = '';
    try {
      checkSlugs([
        { id: 10, name: 'Same name' },
        { id: 20, name: 'Same name' },
      ]);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('10');
    expect(message).toContain('20');
    expect(message).toContain('"Same name"');
  });

  it('handles multiple independent collisions in one call', () => {
    expect(() =>
      checkSlugs([
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Alpha' },
        { id: 3, name: 'Beta' },
        { id: 4, name: 'Beta' },
      ]),
    ).toThrow('2 slug(s)');
  });

  it('treats whitespace variants as the same slug', () => {
    // Whitespace runs become a single hyphen via slugify.
    expect(() =>
      checkSlugs([
        { id: 1, name: 'Under 75 mortality' },
        { id: 2, name: 'Under  75  mortality' },
      ]),
    ).toThrow('under-75-mortality');
  });

  it('passes an empty list', () => {
    expect(() => checkSlugs([])).not.toThrow();
  });

  it('passes a singleton list', () => {
    expect(() => checkSlugs([{ id: 1, name: 'Foo' }])).not.toThrow();
  });

  it.each([
    ['!!! ???', 'empty'],
    ['2024', 'digits'],
    ['Search', 'reserved'],
  ])('refuses %j, whose slug is %s, naming the indicator', (name, problem) => {
    expect(() =>
      checkSlugs([
        { id: 241, name: 'Diabetes: QOF prevalence' },
        { id: 108, name },
      ]),
    ).toThrow(new RegExp(`108 \\(${JSON.stringify(name).replace(/[?!]/g, '\\$&')}\\): ${problem}`));
  });
});

describe('parseIndicatorIds', () => {
  it('reads a JSON array of indicator ids', () => {
    expect(parseIndicatorIds('[90366, 93280]')).toEqual([90366, 93280]);
  });

  it.each(['[1,"2; DROP TABLE indicator"]', '[0]', '[-5]', '[1.5]', '{"id":1}', '"90366"'])(
    'refuses %s rather than join it into SQL',
    (raw) => {
      expect(() => parseIndicatorIds(raw)).toThrow('JSON array of positive integers');
    },
  );
});

import { describe, expect, it } from 'vitest';

import { createProblemTally } from './data-table-problems.ts';

describe('createProblemTally', () => {
  it('lists problems in the order of the problems page, not the order found', () => {
    const tally = createProblemTally();

    tally.add({ code: 'invalid_numbers', item: '3' });
    tally.add({ code: 'unmatched_area_codes', item: 'E99999999' });

    expect(tally.problems().map(({ code }) => code)).toEqual([
      'unmatched_area_codes',
      'invalid_numbers',
    ]);
  });

  it('keeps the first ten distinct items and counts every finding', () => {
    const tally = createProblemTally();

    for (let line = 2; line < 30; line += 1) {
      tally.add({ code: 'unmatched_area_codes', item: `E9${line % 12}` });
    }

    const [problem] = tally.problems();
    expect(problem?.items).toEqual([
      'E92',
      'E93',
      'E94',
      'E95',
      'E96',
      'E97',
      'E98',
      'E99',
      'E910',
      'E911',
    ]);
    expect(problem?.count).toBe(28);
  });

  it('counts a finding with no item without listing anything', () => {
    const tally = createProblemTally();

    tally.add({ code: 'unpaired_category' });

    expect(tally.problems()).toEqual([{ code: 'unpaired_category', items: [], count: 1 }]);
  });

  it('has no problems until one is added', () => {
    expect(createProblemTally().problems()).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { dimensionKey } from './dimension-key.ts';

describe('dimensionKey', () => {
  it('is empty for a total', () => {
    expect(dimensionKey([])).toBe('');
  });

  it('joins the ids in sorted order, whatever order they come in', () => {
    const female = '019fa38f-096f-7183-9a9a-f925434ae356';
    const allAges = '019fa38f-08d9-76eb-9342-14e9dfd93c6a';

    expect(dimensionKey([female, allAges])).toBe(`${allAges},${female}`);
    expect(dimensionKey([allAges, female])).toBe(`${allAges},${female}`);
  });

  it('lowercases ids, so the key matches the one SQL builds', () => {
    expect(
      dimensionKey([
        '019FA38F-096F-7183-9A9A-F925434AE356',
        '019fa38f-08d9-76eb-9342-14e9dfd93c6a',
      ]),
    ).toBe('019fa38f-08d9-76eb-9342-14e9dfd93c6a,019fa38f-096f-7183-9a9a-f925434ae356');
  });
});

import { expect, it } from 'vitest';
import { loadInBatches } from './batches.ts';

it('preserves order while limiting concurrent loads', async () => {
  let active = 0;
  let maximum = 0;
  const output = await loadInBatches(
    Array.from({ length: 13 }, (_, i) => i),
    async (value) => {
      active++;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active--;
      return value * 2;
    },
  );
  expect(maximum).toBe(4);
  expect(output).toEqual(Array.from({ length: 13 }, (_, i) => i * 2));
});

it('propagates an API failure and does not start another batch', async () => {
  const visited: number[] = [];
  await expect(
    loadInBatches([0, 1, 2, 3, 4], async (value) => {
      visited.push(value);
      if (value === 1) throw new Error('API failed');
      return value;
    }),
  ).rejects.toThrow('API failed');
  expect(visited).not.toContain(4);
});

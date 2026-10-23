import { expect, it } from 'vitest';
import { recentTrendDirection } from './recent-trend.ts';

it('uses five valid points and leaves incomplete series uncalculated', () => {
  expect(recentTrendDirection([1, 2, null, 3, 4])).toBeNull();
  expect(recentTrendDirection([1, 2, null, 3, 4, 5])).toBe('up');
  expect(recentTrendDirection([999, 5, 4, 3, 2, 1, null])).toBe('down');
});
it('uses the established change threshold for stable and zero series', () => {
  expect(recentTrendDirection([100, 100, 100, 100, 101])).toBe('right');
  expect(recentTrendDirection([0, 0, 0, 0, 0])).toBe('right');
});

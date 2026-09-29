import { describe, expect, it } from 'vitest';

import {
  allowance,
  compareToBaseline,
  percentile,
  serialiseBaseline,
  type Work,
} from './budget.ts';

const work = (overrides: Partial<Work> = {}): Work => ({
  statements: 3,
  buffers: 400,
  rows: 50,
  bytes: 20_000,
  ...overrides,
});

describe('allowance', () => {
  it('allows no extra statements', () => {
    expect(allowance('statements', 3)).toBe(3);
  });

  it('adds the ratio and the slack for the other metrics', () => {
    expect(allowance('buffers', 400)).toBe(500);
    expect(allowance('bytes', 20_000)).toBe(23_024);
  });
});

describe('compareToBaseline', () => {
  it('passes a route that matches its baseline', () => {
    expect(compareToBaseline({ 'GET /a': work() }, { 'GET /a': work() })).toEqual({
      failures: [],
      notices: [],
    });
  });

  it('fails one extra statement', () => {
    const { failures } = compareToBaseline(
      { 'GET /a': work({ statements: 4 }) },
      { 'GET /a': work() },
    );
    expect(failures).toEqual(['GET /a statements: 4, over the budget of 3 (baseline 3)']);
  });

  it('passes a rise within the tolerance and fails one beyond it', () => {
    expect(
      compareToBaseline({ 'GET /a': work({ buffers: 500 }) }, { 'GET /a': work() }).failures,
    ).toEqual([]);
    expect(
      compareToBaseline({ 'GET /a': work({ buffers: 501 }) }, { 'GET /a': work() }).failures,
    ).toEqual(['GET /a buffers: 501, over the budget of 500 (baseline 400)']);
  });

  it('notes a metric now well under its baseline without failing', () => {
    const comparison = compareToBaseline(
      { 'GET /a': work({ statements: 1 }) },
      { 'GET /a': work() },
    );
    expect(comparison.failures).toEqual([]);
    expect(comparison.notices).toEqual(['GET /a statements: 1, well under the baseline of 3']);
  });

  it('fails a measured route with no baseline and a baseline route no longer measured', () => {
    expect(compareToBaseline({ 'GET /new': work() }, { 'GET /old': work() }).failures).toEqual([
      'GET /new has no baseline',
      'GET /old is in the baseline but no longer measured',
    ]);
  });
});

describe('serialiseBaseline', () => {
  it('sorts routes and ends with a newline', () => {
    const text = serialiseBaseline({ 'GET /b': work(), 'GET /a': work() });
    expect(Object.keys(JSON.parse(text))).toEqual(['GET /a', 'GET /b']);
    expect(text.endsWith('}\n')).toBe(true);
  });
});

describe('percentile', () => {
  it('takes the nearest rank', () => {
    const samples = [5, 1, 4, 2, 3];
    expect(percentile(samples, 50)).toBe(3);
    expect(percentile(samples, 95)).toBe(5);
    expect(percentile(samples, 0)).toBe(1);
  });
});

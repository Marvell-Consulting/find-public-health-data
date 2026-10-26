import { describe, expect, it } from 'vitest';
import { inequalityTableModel } from './inequalities.ts';
import { selected } from './view.testing.ts';

describe('inequality table model', () => {
  it('chooses a published breakdown area and aligns England to its sex and period', () => {
    const model = inequalityTableModel(selected(), new URLSearchParams());
    expect(model.area?.areaName).toBe('Cornwall');
    expect(model.rows.map(({ value }) => value)).toEqual([32]);
    expect(model.benchmark?.value).toBe(20);
    expect(model.benchmark?.count).toBe(2000);
    expect(model.comparisonConfidence).toBe('99.8');
  });
  it('uses the same category, period and confidence fallbacks for stale views', () => {
    const model = inequalityTableModel(
      selected(),
      new URLSearchParams('ig-108=unknown&ic-108=unpublished&ip-108=missing&ci-108=invalid'),
    );
    expect(model.category).toBe('Deprivation decile');
    expect(model.period).toBe('2024-01-01/2024-12-31');
    expect(model.confidence).toBe('none');
    expect(model.comparisonConfidence).toBe('none');
  });
  it('does not compare with another sex when England lacks the matching segment', () => {
    const indicator = selected();
    const england = indicator.areaData[0];
    if (!england) throw new Error('Missing test England series');
    england.observations = england.observations.filter(({ value }) => value !== 20);
    expect(inequalityTableModel(indicator, new URLSearchParams()).benchmark).toBeUndefined();
  });
});

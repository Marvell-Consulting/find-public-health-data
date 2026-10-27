import { describe, expect, it } from 'vitest';

import { selectedTrendColumns, trendColumnsParam } from './trend.ts';

describe('selectedTrendColumns', () => {
  it('keeps only the chosen measures the data has', () => {
    const params = new URLSearchParams('columns-7=count,numerator,value');

    expect(selectedTrendColumns(params, 7, ['numerator', '95'])).toEqual({
      count: false,
      numerator: true,
      value: true,
      confidence: [],
    });
  });

  it('shows the value and the first available interval when nothing is chosen', () => {
    expect(selectedTrendColumns(new URLSearchParams(), 7, ['count', '99.8'])).toEqual({
      count: false,
      numerator: false,
      value: true,
      confidence: ['99.8'],
    });
  });
});

describe('trendColumnsParam', () => {
  it('lists the chosen columns in table order', () => {
    expect(
      trendColumnsParam({ count: true, numerator: true, value: true, confidence: ['95'] }),
    ).toBe('count,numerator,value,95');
  });

  it('says none when no column is chosen', () => {
    expect(
      trendColumnsParam({ count: false, numerator: false, value: false, confidence: [] }),
    ).toBe('none');
  });
});

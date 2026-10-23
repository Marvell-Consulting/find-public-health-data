import { expect, it } from 'vitest';
import { indicatorPeriodFiltersSchema } from './contract.ts';

it('keeps supported year and refresh filters', () => {
  const period = { fromYear: '2010', toYear: '2023', updatedWithin: '6' };
  expect(indicatorPeriodFiltersSchema.parse(period)).toEqual(period);
});

it.each([
  {},
  { fromYear: 'abc', toYear: '20230', updatedWithin: '9' },
  { fromYear: ['2010'], toYear: null, updatedWithin: 3 },
])('discards absent or invalid period filters: %j', (value) => {
  expect(indicatorPeriodFiltersSchema.parse(value)).toEqual({
    fromYear: '',
    toYear: '',
    updatedWithin: '',
  });
});

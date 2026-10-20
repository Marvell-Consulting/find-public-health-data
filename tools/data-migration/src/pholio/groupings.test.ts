import { expect, it } from 'vitest';
import { createObservationGroupings } from './groupings.ts';

const annual = {
  IndicatorID: 108,
  SexID: 4,
  AgeID: 1,
  YearRange: 1,
  BaselineQuarter: -1,
  BaselineMonth: -1,
};
const observation = { ...annual, Quarter: -1, Month: -1 };

it('distinguishes an unpublished year range from an unpublished period format', () => {
  const groupings = createObservationGroupings([annual]);
  expect(groupings.exclusionReason({ ...observation, YearRange: -1 })).toBe(
    'year_range_not_in_grouping',
  );
  expect(groupings.exclusionReason({ ...observation, Quarter: 3 })).toBe(
    'periodicity_not_in_grouping',
  );
  expect(groupings.exclusionReason(observation)).toBeUndefined();
});

it('retains every period format represented by the indicator groupings', () => {
  const groupings = createObservationGroupings([
    annual,
    { ...annual, BaselineQuarter: 1 },
    { ...annual, YearRange: 3 },
    { ...annual, YearRange: -1, BaselineMonth: 1 },
  ]);
  expect(groupings.exclusionReason({ ...observation, Quarter: 3 })).toBeUndefined();
  expect(groupings.exclusionReason({ ...observation, YearRange: 3 })).toBeUndefined();
  expect(groupings.exclusionReason({ ...observation, YearRange: -1, Month: 7 })).toBeUndefined();
  expect(groupings.exclusionReason({ ...observation, Quarter: 1, Month: 7 })).toBe(
    'periodicity_not_in_grouping',
  );
});

it('does not infer that missing groupings mean an indicator is unpublished', () => {
  const groupings = createObservationGroupings([]);
  expect(groupings.exclusionReason(observation)).toBeUndefined();
  expect(groupings.hasSeries(observation)).toBe(false);
});

it('uses sex and age only to identify the grouped series among duplicate candidates', () => {
  const groupings = createObservationGroupings([annual]);
  const breakdown = { ...observation, SexID: 1, AgeID: 28 };
  expect(groupings.exclusionReason(breakdown)).toBeUndefined();
  expect(groupings.hasSeries(breakdown)).toBe(false);
  expect(groupings.hasSeries(observation)).toBe(true);
  expect(groupings.hasSeries({ ...observation, SexID: -1 })).toBe(false);
});

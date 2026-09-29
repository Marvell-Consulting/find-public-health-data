import { describe, expect, it } from 'vitest';

import {
  goalValue,
  goalValueText,
  benchmarkingSection as section,
} from './indicator-benchmarking-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const goal = {
  hasGoalBenchmark: 'yes',
  goalLowerValue: '90',
  goalUpperValue: '95',
  goalPolarity: 'higher-is-better',
  goalPolicyDetail: 'The national immunisation programme target.',
};

const noGoal = {
  hasGoalBenchmark: 'no',
  goalLowerValue: '',
  goalUpperValue: '',
  goalPolarity: '',
  goalPolicyDetail: '',
};

describe('goalValue', () => {
  it.each([
    ['95', 95],
    ['0.956', 0.956],
    ['.5', 0.5],
    ['-1.5', -1.5],
    ['0', 0],
    ['2,400', 2400],
    ['1,234,567.25', 1234567.25],
  ])('reads %s as %d', (text, value) => {
    expect(goalValue(text)).toBe(value);
  });

  it.each([
    '',
    'abc',
    '95%',
    '9,5',
    '24,00',
    '1,2345',
    '0,500',
    '00,500',
    '-0,250',
    '1e3',
    '1.',
    '+5',
    '--5',
    'Infinity',
    'NaN',
    '0x10',
    '1 000',
    `1${'0'.repeat(400)}`,
  ])('refuses %s', (text) => {
    expect(goalValue(text)).toBeUndefined();
  });
});

describe('goalValueText', () => {
  it.each([
    [null, null],
    [95, '95'],
    [0.956000001, '0.956000001'],
    [-2400, '-2400'],
    [1e21, '1000000000000000000000'],
    [1.5e-7, '0.00000015'],
  ])('shows %s as %s', (value, text) => {
    expect(goalValueText(value)).toBe(text);
  });

  it.each([0.1, 0.1 + 0.2, 1e21, Number.MAX_VALUE, 5e-324, 1.5e-100, -1e-101, 1 / 3])(
    'shows %s as text that reads back as the same value',
    (value) => {
      expect(goalValue(goalValueText(value) ?? '')).toBe(value);
    },
  );
});

describe('benchmarkingSection', () => {
  it('takes a goal without the spaces around its answers', () => {
    expect(
      section.schema.parse({
        ...goal,
        goalLowerValue: ' 90 ',
        goalUpperValue: '\t95',
        goalPolicyDetail: ' The target. \n',
      }),
    ).toEqual({ ...goal, goalPolicyDetail: 'The target.' });
  });

  it.each([
    ['no goal', noGoal],
    ['a goal', goal],
    ['a single goal value', { ...goal, goalUpperValue: '' }],
    ['a goal without detail', { ...goal, goalPolicyDetail: '' }],
    ['a low-is-good goal', { ...goal, goalPolarity: 'lower-is-better' }],
    ['grouped and negative values', { ...goal, goalLowerValue: '-2,400', goalUpperValue: '1,000' }],
    [
      'no goal beside answers the form hid',
      { ...noGoal, goalLowerValue: 'abc', goalUpperValue: '1', goalPolarity: 'lower-is-better' },
    ],
  ])('accepts %s', (_, body) => {
    expect(sectionFieldErrors(section, body)).toBeUndefined();
  });

  it('asks whether there are goal benchmarks when nothing is answered', () => {
    expect(sectionFieldErrors(section, { ...noGoal, hasGoalBenchmark: '' })).toEqual({
      hasGoalBenchmark: 'Select whether there are any goal benchmarks for this indicator',
    });
  });

  it('asks for the lower value and polarity of a goal given neither', () => {
    expect(sectionFieldErrors(section, { ...noGoal, hasGoalBenchmark: 'yes' })).toEqual({
      goalLowerValue: 'Enter the lower goal value',
      goalPolarity: 'Select the polarity of the goal',
    });
  });

  it('asks for a lower value when only the upper one is given', () => {
    expect(sectionFieldErrors(section, { ...goal, goalLowerValue: ' ' })).toEqual({
      goalLowerValue: 'Enter the lower goal value',
    });
  });

  it('refuses values that are not numbers', () => {
    expect(
      sectionFieldErrors(section, { ...goal, goalLowerValue: '90%', goalUpperValue: 'ninety' }),
    ).toEqual({
      goalLowerValue: 'Lower goal value must be a number',
      goalUpperValue: 'Upper goal value must be a number',
    });
  });

  it.each([
    ['below', '85'],
    ['equal to', '90'],
  ])('refuses an upper value %s the lower one', (_, goalUpperValue) => {
    expect(sectionFieldErrors(section, { ...goal, goalUpperValue })).toEqual({
      goalUpperValue: 'Upper goal value must be higher than the lower goal value',
    });
  });

  it('compares the values as numbers, not text', () => {
    expect(
      sectionFieldErrors(section, { ...goal, goalLowerValue: '9', goalUpperValue: '10' }),
    ).toBeUndefined();
  });

  it.each([
    null,
    {},
    { ...goal, hasGoalBenchmark: 'not-applicable' },
    { ...goal, hasGoalBenchmark: true },
    { ...goal, goalPolarity: 'no-polarity' },
    { ...goal, goalPolarity: 'high-is-good' },
    { ...goal, goalLowerValue: 90 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

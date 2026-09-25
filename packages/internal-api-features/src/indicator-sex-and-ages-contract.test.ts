import { describe, expect, it } from 'vitest';

import {
  type AgeRangeFormValues,
  ageRangeFieldName,
  areSexAndAgesComplete,
  MAX_AGE_RANGES,
  type SexAndAgesAnswers,
  type SexAndAgesFormValues,
  sexAndAgesSection as section,
  sexAndAgesFieldErrors,
  sexAndAgesFormValues,
} from './indicator-sex-and-ages-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const blankRange: AgeRangeFormValues = {
  lowerLimit: '',
  lowerLimitUnit: '',
  upperLimit: '',
  upperLimitUnit: '',
};

const range = (values: Partial<AgeRangeFormValues>) => ({ ...blankRange, ...values });

const ranges = (...given: Partial<AgeRangeFormValues>[]): SexAndAgesFormValues => ({
  ...form,
  ageType: 'range',
  ageRanges: given.map(range),
});

const form: SexAndAgesFormValues = {
  sexes: ['persons'],
  ageType: '',
  ageRanges: [],
  specificAge: '',
  specificAgeUnit: '',
  ageOtherDetail: '',
};

/** The page's refusals of a submission, or undefined when the section accepts it. */
function pageErrors(body: SexAndAgesFormValues) {
  const submission = section.schema.safeParse(body);
  return submission.success ? undefined : sexAndAgesFieldErrors(submission.error);
}

describe('sexAndAgesSection', () => {
  it('takes the sexes once each, in the order the page lists them', () => {
    const parsed = section.schema.parse({
      ...ranges({ lowerLimit: '16', lowerLimitUnit: 'years' }),
      sexes: ['males', 'persons', 'males'],
    });

    expect(parsed.sexes).toEqual(['persons', 'males']);
  });

  it('takes the limits and ages without their surrounding spaces', () => {
    const parsed = section.schema.parse({
      ...form,
      ageType: 'specific',
      specificAge: ' 5 ',
      specificAgeUnit: 'weeks',
    });

    expect(parsed).toMatchObject({ specificAge: '5', specificAgeUnit: 'weeks' });
  });

  it.each([
    ['a lower limit alone', { lowerLimit: '65', lowerLimitUnit: 'years' }],
    ['an upper limit alone', { upperLimit: '75', upperLimitUnit: 'years' }],
    [
      'both limits',
      { lowerLimit: '6', lowerLimitUnit: 'weeks', upperLimit: '8', upperLimitUnit: 'weeks' },
    ],
    [
      'an upper limit equal to the lower in another unit',
      { lowerLimit: '1', lowerLimitUnit: 'years', upperLimit: '12', upperLimitUnit: 'months' },
    ],
    ['zero', { lowerLimit: '0', lowerLimitUnit: 'days' }],
    ['999', { upperLimit: '999', upperLimitUnit: 'days' }],
  ])('accepts a range with %s', (_, given) => {
    expect(pageErrors(ranges(given))).toBeUndefined();
  });

  it('accepts all ages, a specific age and other ages', () => {
    expect(pageErrors({ ...form, ageType: 'all' })).toBeUndefined();
    expect(
      pageErrors({ ...form, ageType: 'specific', specificAge: '5', specificAgeUnit: 'years' }),
    ).toBeUndefined();
    expect(pageErrors({ ...form, ageType: 'other', ageOtherDetail: 'Year 6' })).toBeUndefined();
  });

  it.each([
    ['other ages', { ageType: 'other', ageOtherDetail: 'Year 6' }],
    ['all ages', { ageType: 'all' }],
  ])('asks nothing of the age types not chosen beside %s', (_, given) => {
    expect(
      pageErrors({
        ...form,
        ageRanges: [range({ lowerLimit: 'abc' })],
        specificAge: 'abc',
        ...given,
      }),
    ).toBeUndefined();
  });

  it('refuses an empty form on every question at once', () => {
    expect(sectionFieldErrors(section, { ...form, sexes: [] })).toEqual({
      sexes: 'Select sexes included',
      ageType: 'Select the age type',
    });
  });

  it.each([
    [
      { sexes: ['everyone'], ageType: 'other', ageOtherDetail: 'Year 6' },
      { sexes: 'Select sexes included' },
    ],
    [
      { sexes: 'persons', ageType: 'other', ageOtherDetail: 'Year 6' },
      { sexes: 'Select sexes included' },
    ],
    [{ ageType: 'everyone' }, { ageType: 'Select the age type' }],
    [
      { ageType: 'specific' },
      { specificAge: 'Enter the age', specificAgeUnit: 'Select the periods' },
    ],
    [
      { ageType: 'specific', specificAge: '5.5', specificAgeUnit: 'years' },
      { specificAge: 'Age must be a whole number from 0 to 999' },
    ],
    [
      { ageType: 'specific', specificAge: '1000', specificAgeUnit: 'years' },
      { specificAge: 'Age must be a whole number from 0 to 999' },
    ],
    [{ ageType: 'specific', specificAgeUnit: 'years' }, { specificAge: 'Enter the age' }],
    [
      { ageType: 'specific', specificAge: '5', specificAgeUnit: 'decades' },
      { specificAgeUnit: 'Select the periods' },
    ],
    [{ ageType: 'other', ageOtherDetail: ' ' }, { ageOtherDetail: 'Enter the ages included' }],
  ])('refuses %o', (answers, fieldErrors) => {
    expect(sectionFieldErrors(section, { ...form, ...answers })).toEqual(fieldErrors);
  });

  it.each([
    [[blankRange], { lowerLimit: 'You must enter at least a lower or upper limit' }],
    [[{ lowerLimit: '5' }], { lowerLimitUnit: 'Select the periods for the lower limit' }],
    [[{ upperLimitUnit: 'years' }], { upperLimit: 'Enter the upper limit' }],
    [
      [{ lowerLimit: '-1', lowerLimitUnit: 'years' }],
      { lowerLimit: 'Lower limit must be a whole number from 0 to 999' },
    ],
    [
      [{ lowerLimit: 'abc' }],
      {
        lowerLimit: 'Lower limit must be a whole number from 0 to 999',
        lowerLimitUnit: 'Select the periods for the lower limit',
      },
    ],
    [
      [{ lowerLimit: '5', lowerLimitUnit: 'years', upperLimit: '4', upperLimitUnit: 'years' }],
      { upperLimit: 'Upper limit must not be lower than the lower limit' },
    ],
    [
      [{ lowerLimit: '1', lowerLimitUnit: 'years', upperLimit: '51', upperLimitUnit: 'weeks' }],
      { upperLimit: 'Upper limit must not be lower than the lower limit' },
    ],
  ] as const)('refuses the range %o on the part at fault', (given, errors) => {
    const expected = Object.fromEntries(
      Object.entries(errors).map(([part, message]) => [
        ageRangeFieldName(0, part as keyof AgeRangeFormValues),
        message,
      ]),
    );

    expect(pageErrors(ranges(...given))).toEqual(expected);
  });

  it('names the range from the second on, so every refusal is told apart', () => {
    const valid = { lowerLimit: '16', lowerLimitUnit: 'years' };

    expect(
      pageErrors(
        ranges(
          valid,
          blankRange,
          { lowerLimit: '5', upperLimitUnit: 'years' },
          { lowerLimit: '9', lowerLimitUnit: 'days', upperLimit: '1', upperLimitUnit: 'days' },
          { upperLimit: 'x', upperLimitUnit: 'days' },
        ),
      ),
    ).toEqual({
      [ageRangeFieldName(1, 'lowerLimit')]:
        'You must enter at least a lower or upper limit for range 2',
      [ageRangeFieldName(2, 'lowerLimitUnit')]: 'Select the periods for lower limit 3',
      [ageRangeFieldName(2, 'upperLimit')]: 'Enter upper limit 3',
      [ageRangeFieldName(3, 'upperLimit')]: 'Upper limit 4 must not be lower than lower limit 4',
      [ageRangeFieldName(4, 'upperLimit')]: 'Upper limit 5 must be a whole number from 0 to 999',
    });
  });

  it('refuses a range answer with no ranges where the first one goes', () => {
    expect(pageErrors(ranges())).toEqual({
      [ageRangeFieldName(0, 'lowerLimit')]: 'You must enter at least a lower or upper limit',
    });
  });

  it('refuses more ranges than the page offers', () => {
    const full = Array.from({ length: MAX_AGE_RANGES + 1 }, (_, index) => ({
      lowerLimit: String(index),
      lowerLimitUnit: 'years',
    }));

    expect(sectionFieldErrors(section, ranges(...full))).toEqual({
      ageRanges: 'You cannot add more than 20 ranges',
    });
  });

  it('answers the API by field, a range refused as the list', () => {
    expect(sectionFieldErrors(section, ranges({ lowerLimit: '5' }))).toEqual({
      ageRanges: 'Select the periods for the lower limit',
    });
  });

  it('accepts what it gave, so the API can apply it again', () => {
    const parsed = section.schema.parse({
      ...ranges({ lowerLimit: ' 16 ', lowerLimitUnit: 'years' }),
      sexes: ['males', 'persons'],
    });

    expect(section.schema.parse(parsed)).toEqual(parsed);
  });
});

describe('areSexAndAgesComplete', () => {
  const unanswered: SexAndAgesAnswers = {
    sexes: [],
    ageType: null,
    ageRanges: [],
    specificAge: null,
    specificAgeUnit: null,
    ageOtherDetail: null,
  };
  const sixteenPlus = {
    lowerLimit: 16,
    lowerLimitUnit: 'years',
    upperLimit: null,
    upperLimitUnit: null,
  } as const;

  it.each([
    [unanswered, false],
    [{ ...unanswered, sexes: ['persons'] }, false],
    [{ ...unanswered, sexes: ['persons'], ageType: 'range' }, false],
    [{ ...unanswered, sexes: ['persons'], ageType: 'range', ageRanges: [sixteenPlus] }, true],
    [{ ...unanswered, ageType: 'range', ageRanges: [sixteenPlus] }, false],
    [{ ...unanswered, sexes: ['persons'], ageType: 'all' }, true],
    [{ ...unanswered, ageType: 'all' }, false],
    [
      {
        ...unanswered,
        sexes: ['males'],
        ageType: 'specific',
        specificAge: 0,
        specificAgeUnit: 'days',
      },
      true,
    ],
  ] as const)('judges %o complete: %s', (answers, complete) => {
    expect(
      areSexAndAgesComplete({
        ...answers,
        sexes: [...answers.sexes],
        ageRanges: [...answers.ageRanges],
      }),
    ).toBe(complete);
  });
});

describe('sexAndAgesFormValues', () => {
  it('gives each stored age as text, and each unanswered one as empty', () => {
    expect(
      sexAndAgesFormValues({
        sexes: ['females'],
        ageType: 'range',
        ageRanges: [
          { lowerLimit: 0, lowerLimitUnit: 'days', upperLimit: null, upperLimitUnit: null },
        ],
        specificAge: null,
        specificAgeUnit: null,
        ageOtherDetail: null,
      }),
    ).toEqual({
      sexes: ['females'],
      ageType: 'range',
      ageRanges: [{ lowerLimit: '0', lowerLimitUnit: 'days', upperLimit: '', upperLimitUnit: '' }],
      specificAge: '',
      specificAgeUnit: '',
      ageOtherDetail: '',
    });
  });
});

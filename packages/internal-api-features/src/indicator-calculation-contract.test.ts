import { describe, expect, it } from 'vitest';

import { calculationSection as section } from './indicator-calculation-contract.ts';
import { sectionFieldErrors } from './testing.ts';

describe('calculationSection', () => {
  it('takes the methodology and the other organisations without their surrounding spaces', () => {
    expect(
      section.schema.parse({
        methodology: '  A method\n',
        calculatedBy: 'other',
        calculatedByOther: '\tONS ',
      }),
    ).toEqual({ methodology: 'A method', calculatedBy: 'other', calculatedByOther: 'ONS' });
  });

  it.each(['ohid', 'dhsc'] as const)(
    'asks for no details when %s calculated it',
    (calculatedBy) => {
      expect(
        sectionFieldErrors(section, {
          methodology: 'A method',
          calculatedBy,
          calculatedByOther: '',
        }),
      ).toBeUndefined();
    },
  );

  it.each([
    [
      { methodology: '', calculatedBy: '', calculatedByOther: '' },
      {
        methodology: 'Enter the methodology',
        calculatedBy: 'Select who calculated the indicator',
      },
    ],
    [
      { methodology: ' ', calculatedBy: 'ohid', calculatedByOther: '' },
      { methodology: 'Enter the methodology' },
    ],
    [
      { methodology: 'A method', calculatedBy: '', calculatedByOther: 'ONS' },
      { calculatedBy: 'Select who calculated the indicator' },
    ],
    [
      { methodology: 'A method', calculatedBy: 'other', calculatedByOther: ' \n' },
      { calculatedByOther: 'Enter details of the other organisation or organisations' },
    ],
    [
      { methodology: '', calculatedBy: 'other', calculatedByOther: '' },
      {
        methodology: 'Enter the methodology',
        calculatedByOther: 'Enter details of the other organisation or organisations',
      },
    ],
    [
      { methodology: 'A method', calculatedBy: 'nhs', calculatedByOther: '' },
      { calculatedBy: 'Select who calculated the indicator' },
    ],
  ])('refuses %o', (body, fieldErrors) => {
    expect(sectionFieldErrors(section, body)).toEqual(fieldErrors);
  });

  it.each([
    {},
    { methodology: 'A method', calculatedBy: 'ohid' },
    { methodology: 1, calculatedBy: 'ohid', calculatedByOther: '' },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });

  it('accepts long answers, setting no length limit of its own', () => {
    const long = 'a'.repeat(20_000);

    expect(
      sectionFieldErrors(section, {
        methodology: long,
        calculatedBy: 'other',
        calculatedByOther: long,
      }),
    ).toBeUndefined();
  });
});

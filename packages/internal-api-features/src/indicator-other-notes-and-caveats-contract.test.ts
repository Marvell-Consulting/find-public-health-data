import { describe, expect, it } from 'vitest';

import { otherNotesAndCaveatsSection as section } from './indicator-other-notes-and-caveats-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const empty = {
  disclosureControl: '',
  disclosureControlDetail: '',
  roundingApplied: '',
  roundingDetail: '',
  caveatsNeeded: '',
  caveatsDetail: '',
  otherNotesNeeded: '',
  otherNotesDetail: '',
};

const allNo = {
  ...empty,
  disclosureControl: 'no',
  roundingApplied: 'no',
  caveatsNeeded: 'no',
  otherNotesNeeded: 'no',
};

const allYes = {
  ...empty,
  disclosureControl: 'yes',
  roundingApplied: 'yes',
  caveatsNeeded: 'yes',
  otherNotesNeeded: 'yes',
};

describe('otherNotesAndCaveatsSection', () => {
  it('takes every detail without its surrounding spaces', () => {
    expect(
      section.schema.parse({
        disclosureControl: 'yes',
        disclosureControlDetail: '  Counts under 5 are suppressed.\n',
        roundingApplied: 'yes',
        roundingDetail: ' Rounded to the nearest 5. ',
        caveatsNeeded: 'yes',
        caveatsDetail: '\tSurvey data. ',
        otherNotesNeeded: 'yes',
        otherNotesDetail: ' Revised in 2024.',
      }),
    ).toEqual({
      disclosureControl: 'yes',
      disclosureControlDetail: 'Counts under 5 are suppressed.',
      roundingApplied: 'yes',
      roundingDetail: 'Rounded to the nearest 5.',
      caveatsNeeded: 'yes',
      caveatsDetail: 'Survey data.',
      otherNotesNeeded: 'yes',
      otherNotesDetail: 'Revised in 2024.',
    });
  });

  it('asks for no details when every answer is no', () => {
    expect(sectionFieldErrors(section, allNo)).toBeUndefined();
  });

  it('asks for no detail when disclosure control is not applicable', () => {
    expect(
      sectionFieldErrors(section, { ...allNo, disclosureControl: 'not-applicable' }),
    ).toBeUndefined();
  });

  it('asks for every answer when the form is empty', () => {
    expect(sectionFieldErrors(section, empty)).toEqual({
      disclosureControl: 'Select whether disclosure control has been applied',
      roundingApplied: 'Select whether rounding has been applied',
      caveatsNeeded: 'Select whether there are any caveats needed',
      otherNotesNeeded: 'Select whether there are any other notes needed',
    });
  });

  it('asks for the details of every yes, blank ones included', () => {
    expect(sectionFieldErrors(section, { ...allYes, caveatsDetail: ' \n' })).toEqual({
      disclosureControlDetail: 'Provide details of the disclosure control',
      roundingDetail: 'Provide details of the rounding',
      caveatsDetail: 'Provide details of the caveats',
      otherNotesDetail: 'Provide details of the other notes',
    });
  });

  it('asks for a missing detail beside an unanswered question', () => {
    expect(
      sectionFieldErrors(section, { ...allNo, disclosureControl: 'yes', roundingApplied: '' }),
    ).toEqual({
      disclosureControlDetail: 'Provide details of the disclosure control',
      roundingApplied: 'Select whether rounding has been applied',
    });
  });

  it.each([
    { ...allNo, disclosureControl: 'maybe' },
    { ...allNo, roundingApplied: 'not-applicable' },
    { ...allNo, caveatsNeeded: true },
  ])('refuses an answer the form does not offer: %o', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });

  it.each([
    null,
    {},
    { disclosureControl: 'no', roundingApplied: 'no' },
    { ...allNo, otherNotesDetail: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

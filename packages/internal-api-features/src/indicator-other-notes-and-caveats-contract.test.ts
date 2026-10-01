import { describe, expect, it } from 'vitest';

import { otherNotesAndCaveatsSection as section } from './indicator-other-notes-and-caveats-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const empty = {
  disclosureControl: '',
  disclosureControlDetail: '',
  hasRounding: '',
  roundingDetail: '',
  hasCaveats: '',
  caveatsDetail: '',
  hasOtherNotes: '',
  otherNotesDetail: '',
};

const allNo = {
  ...empty,
  disclosureControl: 'no',
  hasRounding: 'no',
  hasCaveats: 'no',
  hasOtherNotes: 'no',
};

const allYes = {
  ...empty,
  disclosureControl: 'yes',
  hasRounding: 'yes',
  hasCaveats: 'yes',
  hasOtherNotes: 'yes',
};

describe('otherNotesAndCaveatsSection', () => {
  it('takes every detail without its surrounding spaces', () => {
    expect(
      section.schema.parse({
        disclosureControl: 'yes',
        disclosureControlDetail: '  Counts under 5 are suppressed.\n',
        hasRounding: 'yes',
        roundingDetail: ' Rounded to the nearest 5. ',
        hasCaveats: 'yes',
        caveatsDetail: '\tSurvey data. ',
        hasOtherNotes: 'yes',
        otherNotesDetail: ' Revised in 2024.',
      }),
    ).toEqual({
      disclosureControl: 'yes',
      disclosureControlDetail: 'Counts under 5 are suppressed.',
      hasRounding: 'yes',
      roundingDetail: 'Rounded to the nearest 5.',
      hasCaveats: 'yes',
      caveatsDetail: 'Survey data.',
      hasOtherNotes: 'yes',
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
      hasRounding: 'Select whether rounding has been applied',
      hasCaveats: 'Select whether there are any caveats needed',
      hasOtherNotes: 'Select whether there are any other notes needed',
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

  it.each([
    { ...allNo, disclosureControl: 'maybe' },
    { ...allNo, hasRounding: 'not-applicable' },
    { ...allNo, hasCaveats: true },
  ])('refuses an answer the form does not offer: %o', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });

  it.each([
    null,
    {},
    { disclosureControl: 'no', hasRounding: 'no' },
    { ...allNo, otherNotesDetail: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

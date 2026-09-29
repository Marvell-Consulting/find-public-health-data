import { describe, expect, it } from 'vitest';
import { copyrightAndDataReuseSection as section } from './indicator-copyright-and-data-reuse-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const answered = {
  copyrightNonDefault: 'no',
  copyrightDetail: '',
  dataReuseNonDefault: 'no',
  dataReuseDetail: '',
};

describe('copyrightAndDataReuseSection', () => {
  it('takes every answer without its surrounding spaces', () => {
    expect(
      section.schema.parse({
        copyrightNonDefault: 'yes',
        copyrightDetail: ' Copyright © NHS England\n',
        dataReuseNonDefault: 'yes',
        dataReuseDetail: '\tThe data may be used referencing NHS England. ',
      }),
    ).toEqual({
      copyrightNonDefault: 'yes',
      copyrightDetail: 'Copyright © NHS England',
      dataReuseNonDefault: 'yes',
      dataReuseDetail: 'The data may be used referencing NHS England.',
    });
  });

  it('asks for no details when both follow the defaults', () => {
    expect(sectionFieldErrors(section, answered)).toBeUndefined();
  });

  it('asks both questions when the form is empty', () => {
    expect(
      sectionFieldErrors(section, {
        copyrightNonDefault: '',
        copyrightDetail: '',
        dataReuseNonDefault: '',
        dataReuseDetail: '',
      }),
    ).toEqual({
      copyrightNonDefault: 'Select whether the copyright is anything other than Crown copyright',
      dataReuseNonDefault: 'Select whether the data re-use is different to the default',
    });
  });

  it('asks for the details of each answer that differs, blank ones included', () => {
    expect(
      sectionFieldErrors(section, {
        copyrightNonDefault: 'yes',
        copyrightDetail: ' \n',
        dataReuseNonDefault: 'yes',
        dataReuseDetail: '',
      }),
    ).toEqual({
      copyrightDetail: 'Provide details of the copyright',
      dataReuseDetail: 'Provide details of the data re-use',
    });
  });

  it('asks for missing details beside an unanswered question', () => {
    expect(
      sectionFieldErrors(section, {
        ...answered,
        copyrightNonDefault: 'yes',
        dataReuseNonDefault: '',
      }),
    ).toEqual({
      copyrightDetail: 'Provide details of the copyright',
      dataReuseNonDefault: 'Select whether the data re-use is different to the default',
    });
  });

  it.each([
    null,
    {},
    { ...answered, copyrightNonDefault: 'not-applicable' },
    { ...answered, dataReuseNonDefault: true },
    { ...answered, copyrightDetail: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

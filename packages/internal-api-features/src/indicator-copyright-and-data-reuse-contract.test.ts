import { describe, expect, it } from 'vitest';
import { copyrightAndDataReuseSection as section } from './indicator-copyright-and-data-reuse-contract.ts';
import { sectionFieldErrors } from './testing.ts';

const answered = {
  hasCustomCopyright: 'no',
  customCopyrightDetail: '',
  hasCustomDataReuse: 'no',
  customDataReuseDetail: '',
};

describe('copyrightAndDataReuseSection', () => {
  it('takes every answer without its surrounding spaces', () => {
    expect(
      section.schema.parse({
        hasCustomCopyright: 'yes',
        customCopyrightDetail: ' Copyright © NHS England\n',
        hasCustomDataReuse: 'yes',
        customDataReuseDetail: '\tThe data may be used referencing NHS England. ',
      }),
    ).toEqual({
      hasCustomCopyright: 'yes',
      customCopyrightDetail: 'Copyright © NHS England',
      hasCustomDataReuse: 'yes',
      customDataReuseDetail: 'The data may be used referencing NHS England.',
    });
  });

  it('asks for no details when both follow the defaults', () => {
    expect(sectionFieldErrors(section, answered)).toBeUndefined();
  });

  it('asks both questions when the form is empty', () => {
    expect(
      sectionFieldErrors(section, {
        hasCustomCopyright: '',
        customCopyrightDetail: '',
        hasCustomDataReuse: '',
        customDataReuseDetail: '',
      }),
    ).toEqual({
      hasCustomCopyright: 'Select whether the copyright is anything other than Crown copyright',
      hasCustomDataReuse: 'Select whether the data re-use is different to the default',
    });
  });

  it('asks for the details of each answer that differs, blank ones included', () => {
    expect(
      sectionFieldErrors(section, {
        hasCustomCopyright: 'yes',
        customCopyrightDetail: ' \n',
        hasCustomDataReuse: 'yes',
        customDataReuseDetail: '',
      }),
    ).toEqual({
      customCopyrightDetail: 'Provide details of the copyright',
      customDataReuseDetail: 'Provide details of the data re-use',
    });
  });

  it.each([
    null,
    {},
    { ...answered, hasCustomCopyright: 'not-applicable' },
    { ...answered, hasCustomDataReuse: true },
    { ...answered, customCopyrightDetail: 108 },
  ])('refuses %o, which the form never sends', (body) => {
    expect(sectionFieldErrors(section, body)).toBeDefined();
  });
});

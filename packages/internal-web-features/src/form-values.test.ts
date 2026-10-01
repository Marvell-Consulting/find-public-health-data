import { describe, expect, it } from 'vitest';

import { readFormValues } from './form-values.ts';

describe('readFormValues', () => {
  it('reads each field as typed, and one the browser did not send as empty', () => {
    const formData = new FormData();
    formData.set('definition', '  As typed  ');

    expect(readFormValues(formData, ['definition', 'rationale'])).toEqual({
      definition: '  As typed  ',
      rationale: '',
    });
  });

  it('ignores anything posted that is not one of the fields', () => {
    const formData = new FormData();
    formData.set('definition', 'A definition');
    formData.set('extra', 'Not a field');

    expect(readFormValues(formData, ['definition'])).toEqual({ definition: 'A definition' });
  });

  it('reads a field from the control named for it', () => {
    const formData = new FormData();
    formData.set('date[day]', '14');

    expect(readFormValues(formData, ['day'], { day: 'date[day]' })).toEqual({ day: '14' });
  });
});

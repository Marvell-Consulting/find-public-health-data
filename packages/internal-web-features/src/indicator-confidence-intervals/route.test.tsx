// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { handle } from './route.tsx';

describe('the confidence intervals route', () => {
  it('links back to the task list from above the page', () => {
    if (typeof handle.backHref !== 'function') throw new Error('back link needs the loader');

    const id = '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b';
    const values = {
      ciMethodId: '',
      ciMethodModified: '',
      ciMethodModifications: '',
      ciMethodOtherDetail: '',
    };

    expect(handle.backHref({ id, values, methods: [] })).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });
});

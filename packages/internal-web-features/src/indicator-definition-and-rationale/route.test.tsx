// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { handle } from './route.tsx';

describe('the definition and rationale route', () => {
  it('links back to the task list from above the page', () => {
    if (typeof handle.backHref !== 'function') throw new Error('back link needs the loader');

    const id = '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b';

    expect(handle.backHref({ id, values: { definition: '', rationale: '' } })).toBe(
      `/publish/indicators/${id}/task-list`,
    );
  });
});

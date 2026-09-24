// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sectionBackLinkHandle } from './indicator-section-route.ts';

describe('sectionBackLinkHandle', () => {
  it("links back to the draft's task list from above the page", () => {
    if (typeof sectionBackLinkHandle.backHref !== 'function') {
      throw new Error('back link needs the loader');
    }

    const id = '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b';

    expect(sectionBackLinkHandle.backHref({ id })).toBe(`/publish/indicators/${id}/task-list`);
  });
});

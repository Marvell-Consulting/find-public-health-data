// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { handle as editHandle } from './edit-route.tsx';
import type { IndicatorAdminDetail } from './loader.ts';
import { handle as newHandle } from './new-route.tsx';

const indicator: IndicatorAdminDetail = {
  id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
  shortId: 90366,
  name: 'Life expectancy at birth',
  publishedSlug: null,
  indicatorStatus: 'new',
  draftStatus: 'draft',
  updatedAt: '2026-08-04T23:30:00.000Z',
};

describe('the indicator name routes', () => {
  it('links a new indicator back to the dashboard from above the page', () => {
    expect(newHandle.backHref).toBe('/dashboard');
  });

  it('links a draft being renamed back to its task list from above the page', () => {
    if (typeof editHandle.backHref !== 'function') throw new Error('back link needs the loader');

    expect(editHandle.backHref({ indicator })).toBe(
      `/publish/indicators/${indicator.id}/task-list`,
    );
  });
});

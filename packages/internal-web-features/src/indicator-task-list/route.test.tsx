// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import type { IndicatorTaskList } from './loader.ts';
import { handle } from './route.tsx';

const taskList: IndicatorTaskList = {
  indicator: {
    id: '019a1b2c-3d4e-7f60-8a9b-0c1d2e3f4a5b',
    shortId: 90366,
    name: 'Life expectancy at birth',
    indicatorStatus: 'new',
    draftStatus: 'draft',
  },
  isUpdate: false,
  canSubmit: true,
  tasks: { name: 'completed' },
};

describe('the task list route', () => {
  it('links back to the indicator overview from above the page', () => {
    if (typeof handle.backHref !== 'function') throw new Error('back link needs the loader');

    expect(handle.backHref({ taskList })).toBe(`/dashboard/indicators/${taskList.indicator.id}`);
  });
});

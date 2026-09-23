import { describe, expect, it } from 'vitest';

import { indicatorTaskListSchema } from './contract.ts';
import { type IndicatorTaskListSource, indicatorTaskList } from './indicator-task-list.ts';

const source: IndicatorTaskListSource = {
  indicator: { id: '00000000-0000-7000-8000-000000000001', shortId: 90366 },
  draft: { name: 'Life expectancy at birth' },
  hasPublished: false,
};

describe('indicatorTaskList', () => {
  it('names the indicator from the draft being edited', () => {
    const state = indicatorTaskList({ ...source, draft: { name: 'Renamed indicator' } });

    expect(state.indicator).toEqual({
      id: source.indicator.id,
      shortId: 90366,
      name: 'Renamed indicator',
    });
  });

  it('counts the name as complete, which a draft cannot exist without', () => {
    expect(indicatorTaskList(source).tasks).toEqual({ name: 'completed' });
  });

  it.each([
    [false, 'a first publication'],
    [true, 'an update to what is published'],
  ])('reports a draft with hasPublished %s as %s', (hasPublished) => {
    expect(indicatorTaskList({ ...source, hasPublished }).isUpdate).toBe(hasPublished);
  });

  it('allows submission while every task it carries is complete', () => {
    expect(indicatorTaskList(source).canSubmit).toBe(true);
  });

  it('answers in the shape the contract describes', () => {
    expect(indicatorTaskListSchema.safeParse(indicatorTaskList(source)).success).toBe(true);
  });
});

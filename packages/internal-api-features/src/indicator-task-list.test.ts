import { describe, expect, it } from 'vitest';

import { indicatorTaskListSchema } from './contract.ts';
import {
  type IndicatorTaskListDraft,
  type IndicatorTaskListSource,
  indicatorTaskList,
} from './indicator-task-list.ts';

// A draft as the name page leaves it: named, with every other answer still to give.
const source: IndicatorTaskListSource = {
  indicator: {
    id: '00000000-0000-7000-8000-000000000001',
    shortId: 90366,
    indicatorStatus: 'new',
    draftStatus: 'draft',
  },
  draft: { name: 'Life expectancy at birth', definition: null, rationale: null },
};

const complete: IndicatorTaskListDraft = {
  name: 'Life expectancy at birth',
  definition: 'The average number of years a newborn would live.',
  rationale: 'A summary measure of mortality across the whole population.',
};

function withDraft(draft: Partial<IndicatorTaskListDraft>): IndicatorTaskListSource {
  return { ...source, draft: { ...source.draft, ...draft } };
}

function withIndicatorStatus(indicatorStatus: 'new' | 'live'): IndicatorTaskListSource {
  return { ...source, indicator: { ...source.indicator, indicatorStatus } };
}

describe('indicatorTaskList', () => {
  it('names the indicator from the draft being edited, beside its statuses', () => {
    const state = indicatorTaskList(withDraft({ name: 'Renamed indicator' }));

    expect(state.indicator).toEqual({
      id: source.indicator.id,
      shortId: 90366,
      name: 'Renamed indicator',
      indicatorStatus: 'new',
      draftStatus: 'draft',
    });
  });

  it('counts the name as complete, which a draft cannot exist without', () => {
    expect(indicatorTaskList(source).tasks.name).toBe('completed');
  });

  it('counts the definition and rationale as complete once both hold text', () => {
    expect(indicatorTaskList(withDraft(complete)).tasks['definition-and-rationale']).toBe(
      'completed',
    );
  });

  it.each([
    ['neither', {}],
    ['only the definition', { definition: complete.definition }],
    ['only the rationale', { rationale: complete.rationale }],
    ['a blank definition', { definition: '  ', rationale: complete.rationale }],
  ])('leaves the definition and rationale not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['definition-and-rationale']).toBe(
      'not_started',
    );
  });

  it.each([
    ['new', false],
    ['live', true],
  ] as const)('reports a draft of a %s indicator as an update: %s', (status, isUpdate) => {
    expect(indicatorTaskList(withIndicatorStatus(status)).isUpdate).toBe(isUpdate);
  });

  it('allows submission once every task it carries is complete', () => {
    expect(indicatorTaskList(withDraft(complete)).canSubmit).toBe(true);
  });

  it('holds submission back while any task it carries is not started', () => {
    expect(indicatorTaskList(source).canSubmit).toBe(false);
  });

  it('answers in the shape the contract describes', () => {
    expect(indicatorTaskListSchema.safeParse(indicatorTaskList(source)).success).toBe(true);
  });
});

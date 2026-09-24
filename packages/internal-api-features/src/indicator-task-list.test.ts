import { describe, expect, it } from 'vitest';

import { indicatorTaskListSchema } from './contract.ts';
import {
  type IndicatorTaskListDraft,
  type IndicatorTaskListSource,
  indicatorTaskList,
} from './indicator-task-list.ts';

const ciMethodId = '019fa38f-073f-764e-9ac6-1c4d03b1cb92';

// A draft as the name page leaves it: named, with every other answer still to give.
const source: IndicatorTaskListSource = {
  indicator: {
    id: '00000000-0000-7000-8000-000000000001',
    shortId: 90366,
    indicatorStatus: 'new',
    draftStatus: 'draft',
  },
  draft: {
    name: 'Life expectancy at birth',
    definition: null,
    rationale: null,
    polarity: null,
    methodology: null,
    calculatedBy: null,
    calculatedByOther: null,
    ciMethodId: null,
    ciMethodKind: null,
    ciMethodModified: null,
    ciMethodModifications: null,
    ciMethodOtherDetail: null,
  },
};

const complete: IndicatorTaskListDraft = {
  name: 'Life expectancy at birth',
  definition: 'The average number of years a newborn would live.',
  rationale: 'A summary measure of mortality across the whole population.',
  polarity: 'lower-is-better',
  methodology: 'Calculated from mortality rates by single year of age.',
  calculatedBy: 'ohid',
  calculatedByOther: null,
  ciMethodId,
  ciMethodKind: 'standard',
  ciMethodModified: false,
  ciMethodModifications: null,
  ciMethodOtherDetail: null,
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

  it('counts the polarity as complete once one is chosen', () => {
    expect(indicatorTaskList(withDraft({ polarity: complete.polarity })).tasks.polarity).toBe(
      'completed',
    );
  });

  it('leaves the polarity not started until one is chosen', () => {
    expect(indicatorTaskList(source).tasks.polarity).toBe('not_started');
  });

  it.each([
    ['OHID', { calculatedBy: 'ohid' }],
    ['DHSC', { calculatedBy: 'dhsc' }],
    ['other organisations it names', { calculatedBy: 'other', calculatedByOther: 'ONS' }],
  ] as const)('counts the calculation as complete with a methodology and %s', (_, answer) => {
    const state = indicatorTaskList(withDraft({ methodology: complete.methodology, ...answer }));

    expect(state.tasks.calculation).toBe('completed');
  });

  it.each([
    ['nothing', {}],
    ['only the methodology', { methodology: complete.methodology }],
    ['only who calculated it', { calculatedBy: 'dhsc' }],
    ['a blank methodology', { methodology: ' ', calculatedBy: 'dhsc' }],
    [
      'other organisations it does not name',
      { methodology: complete.methodology, calculatedBy: 'other' },
    ],
    [
      'blank details of the other organisations',
      { methodology: complete.methodology, calculatedBy: 'other', calculatedByOther: '\n' },
    ],
  ] as const)('leaves the calculation not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks.calculation).toBe('not_started');
  });

  it.each([
    ['no method is chosen', {}, 'not_started'],
    [
      'a standard method is unmodified',
      { ciMethodId, ciMethodKind: 'standard', ciMethodModified: false },
      'completed',
    ],
    [
      'a standard method is modified as described',
      {
        ciMethodId,
        ciMethodKind: 'standard',
        ciMethodModified: true,
        ciMethodModifications: 'Adjusted',
      },
      'completed',
    ],
    [
      'a standard method is modified with no description',
      { ciMethodId, ciMethodKind: 'standard', ciMethodModified: true, ciMethodModifications: ' ' },
      'not_started',
    ],
    [
      'a standard method has no answer on modifications',
      { ciMethodId, ciMethodKind: 'standard', ciMethodModified: null },
      'not_started',
    ],
    [
      'an other method is detailed',
      { ciMethodId, ciMethodKind: 'other', ciMethodOtherDetail: 'Bootstrap intervals' },
      'completed',
    ],
    ['an other method has no detail', { ciMethodId, ciMethodKind: 'other' }, 'not_started'],
    ['the method has nothing to describe', { ciMethodId, ciMethodKind: 'none' }, 'completed'],
  ] as const)('judges the confidence intervals when %s', (_, draft, status) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['confidence-intervals']).toBe(status);
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

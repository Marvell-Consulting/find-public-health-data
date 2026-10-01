import { VALUE_TYPE_IDS } from '@fphd/utils/value-type-and-unit';
import { describe, expect, it } from 'vitest';

import { indicatorTaskKeySchema, indicatorTaskListSchema } from './contract.ts';
import {
  type IndicatorTaskListDraft,
  type IndicatorTaskListSource,
  indicatorTaskList,
} from './indicator-task-list.ts';
import { unansweredDraft } from './testing.ts';

const ciMethodId = '019fa38f-073f-764e-9ac6-1c4d03b1cb92';
const ons = { providerId: '01a0d858-9885-764e-8d53-6826aec6729e', sourceId: null };

// A draft as the name page leaves it: named, with every other answer still to give.
const source: IndicatorTaskListSource = {
  indicator: {
    id: '00000000-0000-7000-8000-000000000001',
    shortId: 90366,
    indicatorStatus: 'new',
    draftStatus: 'draft',
  },
  draft: { ...unansweredDraft, name: 'Life expectancy at birth', ciMethodKind: null },
};

// Every section answered as its form would accept.
const complete: IndicatorTaskListDraft = {
  ...source.draft,
  definition: 'The average number of years a newborn would live.',
  rationale: 'A summary measure of mortality across the whole population.',
  polarity: 'lower-is-better',
  methodology: 'Calculated from mortality rates by single year of age.',
  calculatedBy: 'ohid',
  calculatedByDetail: null,
  ciMethodId,
  ciMethodKind: 'standard',
  hasCiMethodModifications: false,
  ciMethodModificationsDetail: null,
  ciMethodDetail: null,
  updateFrequency: 'quarterly',
  periodType: 'years',
  yearType: 'specified-end-date',
  yearEndDay: 31,
  yearEndMonth: 7,
  valueTypeId: VALUE_TYPE_IDS.directlyStandardisedRate,
  standardPopulation: 'esp-2013',
  standardPopulationDetail: null,
  unitId: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9',
  unitDetail: null,
  disclosureControl: 'not-applicable',
  disclosureControlDetail: null,
  hasRounding: false,
  roundingDetail: null,
  hasCaveats: true,
  caveatsDetail: 'Survey data.',
  hasOtherNotes: false,
  otherNotesDetail: null,
  scheduledPublishAt: new Date('2027-09-14T08:30:00.000Z'),
  hasLinks: true,
  links: [{ url: 'https://www.gov.uk/', text: 'Statistical commentary' }],
  variation: 'Varies with the age structure of each area.',
  qualityAssurance: 'Checked against the published ONS figures.',
  hasSourceDataIssues: true,
  sourceDataIssuesDetail: 'Late returns from two areas.',
  hasDataQualityIssues: false,
  ciMethodJustification: 'The standard method for rates.',
  dataSourcesJustification: 'The only national source.',
  inequalitiesIncluded: 'Deprivation deciles.',
  hasExclusions: false,
  exclusionsDetail: null,
  hasAutomation: true,
  automationDetail: 'The shared indicator pipeline.',
  sponsorsAndStakeholders: 'The national screening committee.',
  hasReviewerComments: false,
  reviewerCommentsDetail: null,
  hasCustomCopyright: true,
  customCopyrightDetail: 'Copyright © NHS England',
  hasCustomDataReuse: false,
  customDataReuseDetail: null,
  hasGoalBenchmark: true,
  goalLowerValue: 90,
  goalUpperValue: 95,
  goalPolarity: 'higher-is-better',
  goalPolicyDetail: null,
  sexes: ['persons'],
  ageType: 'range',
  ageRanges: [{ lowerLimit: 16, lowerLimitUnit: 'years', upperLimit: null, upperLimitUnit: null }],
  specificAge: null,
  specificAgeUnit: null,
  ageDetail: null,
  hasRiskFactor: true,
  hasFramework: false,
  topicIds: ['019fa38f-073f-764e-9ac6-1c4d03b10001'],
  classifications: [
    { id: '019fa38f-073f-764e-9ac6-1c4d03b10002', dimension: 'indicator_type' },
    { id: '019fa38f-073f-764e-9ac6-1c4d03b10003', dimension: 'risk_factor' },
  ],
  numeratorSources: [ons],
  numeratorDefinition: 'Deaths registered in the year.',
  denominatorSources: [ons],
  denominatorDefinition: 'Mid-year population.',
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

  const sectionKeys = indicatorTaskKeySchema.options.filter((key) => key !== 'name');

  // Each section's required answers are its schema's, tested in its contract.
  it.each(sectionKeys)('counts %s as complete once its form would accept its answers', (key) => {
    expect(indicatorTaskList(withDraft(complete)).tasks[key]).toBe('completed');
  });

  it.each(sectionKeys)('leaves %s not started while it is unanswered', (key) => {
    expect(indicatorTaskList(source).tasks[key]).toBe('not_started');
  });

  it.each([
    ['its kind is unknown', { ciMethodId, ciMethodKind: null }, 'not_started'],
    [
      'a standard method has no answer on modifications',
      { ciMethodId, ciMethodKind: 'standard', hasCiMethodModifications: null },
      'not_started',
    ],
    [
      'a standard method is modified with no description',
      { ciMethodId, ciMethodKind: 'standard', hasCiMethodModifications: true },
      'not_started',
    ],
    ['an other method has no detail', { ciMethodId, ciMethodKind: 'other' }, 'not_started'],
    [
      'an other method is detailed',
      { ciMethodId, ciMethodKind: 'other', ciMethodDetail: 'Bootstrap intervals' },
      'completed',
    ],
    ['the method has nothing to describe', { ciMethodId, ciMethodKind: 'none' }, 'completed'],
  ] satisfies [string, Partial<IndicatorTaskListDraft>, string][])(
    "judges the confidence intervals by the method's kind when %s",
    (_, draft, status) => {
      expect(indicatorTaskList(withDraft(draft)).tasks['confidence-intervals']).toBe(status);
    },
  );

  it.each([
    ['nothing', {}, 'not_started'],
    ['sources alone', { numeratorSources: [ons] }, 'not_started'],
    ['a definition alone', { numeratorDefinition: complete.numeratorDefinition }, 'not_started'],
    [
      'sources and a definition',
      { numeratorSources: [ons], numeratorDefinition: complete.numeratorDefinition },
      'completed',
    ],
  ] satisfies [string, Partial<IndicatorTaskListDraft>, string][])(
    'judges the numerator with %s',
    (_, draft, status) => {
      expect(indicatorTaskList(withDraft(draft)).tasks.numerator).toBe(status);
    },
  );

  it('judges the denominator from its own answers', () => {
    const numeratorOnly = { numeratorSources: [ons], numeratorDefinition: 'Deaths' };

    expect(indicatorTaskList(withDraft(numeratorOnly)).tasks.denominator).toBe('not_started');
    expect(indicatorTaskList(withDraft(complete)).tasks.denominator).toBe('completed');
  });

  it.each([
    ['new', false],
    ['live', true],
  ] as const)('reports a draft of a %s indicator as an update: %s', (status, isUpdate) => {
    expect(indicatorTaskList(withIndicatorStatus(status)).isUpdate).toBe(isUpdate);
  });

  it('allows submission once every task is complete', () => {
    expect(indicatorTaskList(withDraft(complete)).canSubmit).toBe(true);
  });

  it('holds submission back while any task is not started', () => {
    expect(indicatorTaskList(source).canSubmit).toBe(false);
  });

  it('answers in the shape the contract describes', () => {
    expect(indicatorTaskListSchema.safeParse(indicatorTaskList(source)).success).toBe(true);
  });
});

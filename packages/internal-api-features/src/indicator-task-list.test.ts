import { PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';
import { UNITS, VALUE_TYPES } from '@fphd/utils/value-type-and-unit';
import { describe, expect, it } from 'vitest';

import { indicatorTaskListSchema } from './contract.ts';
import {
  type IndicatorTaskListDraft,
  type IndicatorTaskListSource,
  indicatorTaskList,
} from './indicator-task-list.ts';

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
    updateFrequency: null,
    periodTypeId: null,
    yearTypeId: null,
    yearEndDay: null,
    yearEndMonth: null,
    valueTypeId: null,
    standardPopulation: null,
    standardPopulationDetail: null,
    unitId: null,
    unitOther: null,
    disclosureControl: null,
    disclosureControlDetail: null,
    roundingApplied: null,
    roundingDetail: null,
    caveatsNeeded: null,
    caveatsDetail: null,
    otherNotesNeeded: null,
    otherNotesDetail: null,
    scheduledPublishAtUk: null,
    hasLinks: null,
    links: [],
    variation: null,
    qualityAssurance: null,
    sourceDataIssues: null,
    sourceDataIssuesDetail: null,
    dataQualityIssues: null,
    ciMethodJustification: null,
    dataSourcesJustification: null,
    inequalitiesIncluded: null,
    hasExclusions: null,
    exclusionsDetail: null,
    automationUsed: null,
    automationDetail: null,
    sponsorsAndStakeholders: null,
    hasReviewerComments: null,
    reviewerCommentsDetail: null,
    copyrightNonDefault: null,
    copyrightDetail: null,
    dataReuseNonDefault: null,
    dataReuseDetail: null,
    hasGoalBenchmark: null,
    goalLowerValue: null,
    goalUpperValue: null,
    goalPolarity: null,
    goalPolicyDetail: null,
    sexes: null,
    ageType: null,
    ageRanges: [],
    specificAge: null,
    specificAgeUnit: null,
    ageOtherDetail: null,
    hasRiskFactor: null,
    hasFramework: null,
    topicIds: [],
    classifications: [],
    numeratorSources: [],
    numeratorDefinition: null,
    denominatorSources: [],
    denominatorDefinition: null,
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
  updateFrequency: 'quarterly',
  periodTypeId: PERIOD_TYPES.years.id,
  yearTypeId: YEAR_TYPES.specifiedEndDate.id,
  yearEndDay: 31,
  yearEndMonth: 7,
  valueTypeId: VALUE_TYPES.directlyStandardisedRate.id,
  standardPopulation: 'esp-2013',
  standardPopulationDetail: null,
  unitId: UNITS.per100000.id,
  unitOther: null,
  disclosureControl: 'not-applicable',
  disclosureControlDetail: null,
  roundingApplied: false,
  roundingDetail: null,
  caveatsNeeded: true,
  caveatsDetail: 'Survey data.',
  otherNotesNeeded: false,
  otherNotesDetail: null,
  scheduledPublishAtUk: '2027-09-14T09:30:00+01:00',
  hasLinks: true,
  links: [{ url: 'https://www.gov.uk/', text: 'Statistical commentary' }],
  variation: 'Varies with the age structure of each area.',
  qualityAssurance: 'Checked against the published ONS figures.',
  sourceDataIssues: true,
  sourceDataIssuesDetail: 'Late returns from two areas.',
  dataQualityIssues: false,
  ciMethodJustification: 'The standard method for rates.',
  dataSourcesJustification: 'The only national source.',
  inequalitiesIncluded: 'Deprivation deciles.',
  hasExclusions: false,
  exclusionsDetail: null,
  automationUsed: true,
  automationDetail: 'The shared indicator pipeline.',
  sponsorsAndStakeholders: 'The national screening committee.',
  hasReviewerComments: false,
  reviewerCommentsDetail: null,
  copyrightNonDefault: true,
  copyrightDetail: 'Copyright © NHS England',
  dataReuseNonDefault: false,
  dataReuseDetail: null,
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
  ageOtherDetail: null,
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

  it.each([true, false])('counts data quality as complete once answered, %s', (answer) => {
    const state = indicatorTaskList(withDraft({ dataQualityIssues: answer }));

    expect(state.tasks['data-quality']).toBe('completed');
  });

  it('leaves data quality not started until answered', () => {
    expect(indicatorTaskList(source).tasks['data-quality']).toBe('not_started');
  });

  it('counts the update frequency as complete once one is chosen', () => {
    const state = indicatorTaskList(withDraft({ updateFrequency: complete.updateFrequency }));

    expect(state.tasks['update-frequency']).toBe('completed');
  });

  it('leaves the update frequency not started until one is chosen', () => {
    expect(indicatorTaskList(source).tasks['update-frequency']).toBe('not_started');
  });

  it.each([
    ['months', { periodTypeId: PERIOD_TYPES.months.id }],
    [
      'quarters of a year type',
      { periodTypeId: PERIOD_TYPES.quarters.id, yearTypeId: YEAR_TYPES.financial.id },
    ],
    [
      'years ending on a date',
      {
        periodTypeId: PERIOD_TYPES.years.id,
        yearTypeId: YEAR_TYPES.specifiedEndDate.id,
        yearEndDay: 29,
        yearEndMonth: 2,
      },
    ],
  ])('counts the period type as complete with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['period-type']).toBe('completed');
  });

  it.each([
    ['nothing', {}],
    ['years of no year type', { periodTypeId: PERIOD_TYPES.years.id }],
    [
      'years ending on a date not given',
      { periodTypeId: PERIOD_TYPES.years.id, yearTypeId: YEAR_TYPES.specifiedEndDate.id },
    ],
  ])('leaves the period type not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['period-type']).toBe('not_started');
  });

  it.each([
    ['nothing', {}, 'not_started'],
    [
      'a value type and unit that ask nothing more',
      { valueTypeId: VALUE_TYPES.proportion.id, unitId: UNITS.percent.id },
      'completed',
    ],
    [
      'a directly standardised rate with its standard population',
      {
        valueTypeId: complete.valueTypeId,
        standardPopulation: 'esp-2013',
        unitId: complete.unitId,
      },
      'completed',
    ],
    [
      'a directly standardised rate without its standard population',
      { valueTypeId: complete.valueTypeId, unitId: complete.unitId },
      'not_started',
    ],
    [
      'an indirectly standardised ratio without its reference population',
      { valueTypeId: VALUE_TYPES.indirectlyStandardisedRatio.id, unitId: complete.unitId },
      'not_started',
    ],
    [
      'an other unit with its name',
      { valueTypeId: VALUE_TYPES.count.id, unitId: UNITS.other.id, unitOther: 'people' },
      'completed',
    ],
    ['a value type alone', { valueTypeId: VALUE_TYPES.count.id }, 'not_started'],
  ] as const)('judges the value type and units with %s', (_, draft, status) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['value-type-and-units']).toBe(status);
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

  it('counts the other notes and caveats as complete once every question is answered', () => {
    expect(indicatorTaskList(withDraft(complete)).tasks['other-notes-and-caveats']).toBe(
      'completed',
    );
  });

  it.each([
    ['nothing', {}],
    ['disclosure control unanswered', { ...complete, disclosureControl: null }],
    ['rounding unanswered', { ...complete, roundingApplied: null }],
    ['caveats needed without their details', { ...complete, caveatsDetail: null }],
    ['caveats needed with blank details', { ...complete, caveatsDetail: ' ' }],
  ] as const)('leaves the other notes and caveats not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['other-notes-and-caveats']).toBe(
      'not_started',
    );
  });

  it('counts the publishing date as complete once one is scheduled', () => {
    const draft = { scheduledPublishAtUk: complete.scheduledPublishAtUk };

    expect(indicatorTaskList(withDraft(draft)).tasks['publishing-date']).toBe('completed');
  });

  it('leaves the publishing date not started until one is scheduled', () => {
    expect(indicatorTaskList(source).tasks['publishing-date']).toBe('not_started');
  });

  it.each([
    ['unanswered', {}, 'not_started'],
    ['no links', { hasLinks: false }, 'completed'],
    ['links', { hasLinks: true, links: complete.links }, 'completed'],
    ['links it does not hold', { hasLinks: true }, 'not_started'],
  ] as const)('judges the links when there are %s', (_, draft, status) => {
    expect(indicatorTaskList(withDraft(draft)).tasks.links).toBe(status);
  });

  it('counts the variance and quality as complete once every question is answered', () => {
    expect(indicatorTaskList(withDraft(complete)).tasks['variance-and-quality']).toBe('completed');
  });

  it.each([
    ['nothing', {}],
    ['a blank variation', { ...complete, variation: ' ' }],
    ['quality assurance unanswered', { ...complete, qualityAssurance: null }],
    ['source data issues unanswered', { ...complete, sourceDataIssues: null }],
    ['source data issues without their details', { ...complete, sourceDataIssuesDetail: null }],
  ] as const)('leaves the variance and quality not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['variance-and-quality']).toBe('not_started');
  });

  it('counts the justifications as complete once every question is answered', () => {
    expect(indicatorTaskList(withDraft(complete)).tasks.justifications).toBe('completed');
  });

  it.each([
    ['nothing', {}],
    ['a blank inequalities answer', { ...complete, inequalitiesIncluded: ' ' }],
    ['exclusions unanswered', { ...complete, hasExclusions: null }],
    ['automation used without its details', { ...complete, automationDetail: null }],
  ] as const)('leaves the justifications not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks.justifications).toBe('not_started');
  });

  it.each([
    ['every question answered', complete],
    ['no sponsors or stakeholders', { ...complete, sponsorsAndStakeholders: null }],
  ] as const)('counts the other comments as complete with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['other-comments']).toBe('completed');
  });

  it.each([
    ['nothing', {}],
    ['comments unanswered', { ...complete, hasReviewerComments: null }],
    ['comments without their details', { ...complete, hasReviewerComments: true }],
  ] as const)('leaves the other comments not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['other-comments']).toBe('not_started');
  });

  it('counts the copyright and data re-use as complete once both questions are answered', () => {
    expect(indicatorTaskList(withDraft(complete)).tasks['copyright-and-data-reuse']).toBe(
      'completed',
    );
  });

  it.each([
    ['nothing', {}],
    ['copyright unanswered', { ...complete, copyrightNonDefault: null }],
    ['a different copyright without its details', { ...complete, copyrightDetail: null }],
    ['data re-use unanswered', { ...complete, dataReuseNonDefault: null }],
    ['a different data re-use without its details', { ...complete, dataReuseNonDefault: true }],
  ] as const)('leaves the copyright and data re-use not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['copyright-and-data-reuse']).toBe(
      'not_started',
    );
  });

  it.each([
    ['a goal', complete],
    ['a single goal value', { ...complete, goalUpperValue: null }],
    [
      'tiny values JavaScript writes with an exponent',
      { ...complete, goalLowerValue: 5e-324, goalUpperValue: 1e-101 },
    ],
    [
      'a huge value JavaScript writes with an exponent',
      { ...complete, goalUpperValue: Number.MAX_VALUE },
    ],
    ['no goal', { hasGoalBenchmark: false }],
  ] as const)('counts the benchmarking as complete with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks.benchmarking).toBe('completed');
  });

  it.each([
    ['nothing', {}],
    ['a goal without its lower value', { ...complete, goalLowerValue: null }],
    ['a goal without its polarity', { ...complete, goalPolarity: null }],
  ] as const)('leaves the benchmarking not started with %s', (_, draft) => {
    expect(indicatorTaskList(withDraft(draft)).tasks.benchmarking).toBe('not_started');
  });

  it.each([
    ['unanswered', {}, 'not_started'],
    ['sexes and all ages', { sexes: complete.sexes, ageType: 'all' }, 'completed'],
    [
      'sexes and an age range',
      { sexes: complete.sexes, ageType: 'range', ageRanges: complete.ageRanges },
      'completed',
    ],
    [
      'sexes and a specific age',
      { sexes: complete.sexes, ageType: 'specific', specificAge: 5, specificAgeUnit: 'years' },
      'completed',
    ],
    [
      'sexes and other ages',
      { sexes: complete.sexes, ageType: 'other', ageOtherDetail: 'School year 6' },
      'completed',
    ],
    ['no sexes', { ageType: 'range', ageRanges: complete.ageRanges }, 'not_started'],
    ['an age range it does not hold', { sexes: complete.sexes, ageType: 'range' }, 'not_started'],
  ] as const)('judges the sex and ages when there are %s', (_, draft, status) => {
    expect(indicatorTaskList(withDraft(draft)).tasks['sex-and-ages']).toBe(status);
  });

  it.each([
    ['unanswered', {}, 'not_started'],
    ['every answer', complete, 'completed'],
    ['no topics', { ...complete, topicIds: [] }, 'not_started'],
    [
      'a risk factor it does not hold',
      { ...complete, classifications: complete.classifications.slice(0, 1) },
      'not_started',
    ],
    ['no answer on frameworks', { ...complete, hasFramework: null }, 'not_started'],
  ] satisfies [string, Partial<IndicatorTaskListDraft>, string][])(
    'judges the tagging when there are %s',
    (_, draft, status) => {
      expect(indicatorTaskList(withDraft(draft)).tasks.tagging).toBe(status);
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

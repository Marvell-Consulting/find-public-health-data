import { UNIT_IDS, VALUE_TYPE_IDS } from '@fphd/utils/value-type-and-unit';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { CiMethodRow } from './ci-method-repository.ts';
import {
  benchmarkingSection,
  calculationSection,
  confidenceIntervalsSection,
  copyrightAndDataReuseSection,
  dataQualitySection,
  definitionAndRationaleSection,
  denominatorSection,
  indicatorTaskKeySchema,
  justificationsSection,
  linksSection,
  numeratorSection,
  otherCommentsSection,
  otherNotesAndCaveatsSection,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  type SexAndAges,
  sexAndAgesSection,
  type Tagging,
  type TagOptions,
  taggingSection,
  toFieldErrors,
  updateFrequencySection,
  valueTypeAndUnitsSection,
  varianceAndQualitySection,
} from './contract.ts';
import {
  benchmarkingColumns,
  calculationColumns,
  confidenceIntervalsColumns,
  confidenceIntervalsServerSection,
  dataQualityColumns,
  definitionAndRationaleColumns,
  indicatorSectionsRouter,
  justificationsColumns,
  linksColumns,
  otherCommentsColumns,
  otherNotesAndCaveatsColumns,
  periodTypeColumns,
  polarityColumns,
  publishingDateColumns,
  publishingDateServerSection,
  sexAndAgesColumns,
  taggingColumns,
  taggingServerSection,
  updateFrequencyColumns,
  valueTypeAndUnitsColumns,
  valueTypeAndUnitsServerSection,
  varianceAndQualityColumns,
} from './indicator-sections.ts';
import {
  createFakeInternalRepositories,
  createRouterTestApp,
  testSessionCookie,
  testSessionVerifier,
  unansweredDraft,
} from './testing.ts';

// The HTTP behaviour every section shares is tested in indicator-section.test.ts.

const METHODS: Record<CiMethodRow['kind'], CiMethodRow> = {
  standard: {
    id: '019fa38f-073f-764e-9ac6-1c4d03b1cb92',
    name: "Byar's method",
    description: 'A standard description.',
    kind: 'standard',
  },
  other: {
    id: '019fa38f-0746-7e1c-8826-0ee5d2b83fef',
    name: 'Other method',
    description: null,
    kind: 'other',
  },
  none: {
    id: '019fa38f-0747-73bb-b8a4-bb6e8f3c244e',
    name: 'Unknown',
    description: null,
    kind: 'none',
  },
};

const links = [
  { url: 'https://www.gov.uk/government/statistics', text: 'Statistical commentary' },
  { url: 'https://fingertips.phe.org.uk/', text: 'Fingertips' },
];

// Every follow-up filled in, as a form without JavaScript may send them.
const everyAnswer = {
  hasCiMethodModifications: 'yes',
  ciMethodModificationsDetail: 'Adjusted for clustering',
  ciMethodDetail: 'Bootstrap intervals',
} as const;

// Every section the router serves.
const sections = [
  benchmarkingSection,
  calculationSection,
  confidenceIntervalsSection,
  copyrightAndDataReuseSection,
  dataQualitySection,
  definitionAndRationaleSection,
  denominatorSection,
  justificationsSection,
  linksSection,
  numeratorSection,
  otherCommentsSection,
  otherNotesAndCaveatsSection,
  periodTypeSection,
  polaritySection,
  publishingDateSection,
  sexAndAgesSection,
  taggingSection,
  updateFrequencySection,
  valueTypeAndUnitsSection,
  varianceAndQualitySection,
];

describe('indicatorSectionsRouter', () => {
  it('serves every task but the name', () => {
    expect(sections.map(({ key }) => key).sort()).toEqual(
      indicatorTaskKeySchema.options.filter((key) => key !== 'name').sort(),
    );
  });

  it.each(sections)(
    'serves the $key section, answering every field as null or an empty list',
    async (section) => {
      const repositories = createFakeInternalRepositories({
        indicators: { findDraftState: vi.fn().mockResolvedValue({ draft: unansweredDraft }) },
      });

      const response = await request(
        createRouterTestApp(indicatorSectionsRouter(repositories, testSessionVerifier)),
      )
        .get(`/api/internal/indicators/00000000-0000-7000-8000-000000000001/${section.key}`)
        .set('Cookie', await testSessionCookie(['internal', 'publisher']));

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).sort()).toEqual([...section.fields.options].sort());
      for (const answer of Object.values(response.body)) {
        expect(answer === null || (Array.isArray(answer) && answer.length === 0)).toBe(true);
      }
    },
  );

  it('writes the lists a section gives beside its columns', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });
    const repositories = createFakeInternalRepositories({
      indicators: {
        updateDraft,
        findDraftState: vi
          .fn()
          .mockResolvedValue({ draft: { ...unansweredDraft, hasLinks: true, links } }),
      },
    });

    const response = await request(
      createRouterTestApp(indicatorSectionsRouter(repositories, testSessionVerifier)),
    )
      .put('/api/internal/indicators/00000000-0000-7000-8000-000000000001/links')
      .set('Cookie', await testSessionCookie(['internal', 'publisher']))
      .send({ hasLinks: 'yes', links });

    expect(response.status).toBe(200);
    expect(updateDraft).toHaveBeenCalledWith(
      '00000000-0000-7000-8000-000000000001',
      { hasLinks: true },
      { links },
      'test-user',
    );
    expect(response.body).toEqual({ hasLinks: 'yes', links });
  });
});

describe('definitionAndRationaleColumns', () => {
  it('reads and writes the columns of the same name', () => {
    const answers = { definition: 'A definition', rationale: 'A rationale' };

    expect(definitionAndRationaleColumns.fromDraft({ ...unansweredDraft, ...answers })).toEqual(
      answers,
    );
    expect(definitionAndRationaleColumns.toAttributes(answers)).toEqual(answers);
  });
});

describe('polarityColumns', () => {
  it('reads and writes the column of the same name', () => {
    expect(polarityColumns.fromDraft({ ...unansweredDraft, polarity: 'no-polarity' })).toEqual({
      polarity: 'no-polarity',
    });
    expect(polarityColumns.toAttributes({ polarity: 'no-polarity' })).toEqual({
      polarity: 'no-polarity',
    });
  });
});

describe('dataQualityColumns', () => {
  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads whether there are data quality issues, %s, as %s', (hasDataQualityIssues, answer) => {
    expect(dataQualityColumns.fromDraft({ ...unansweredDraft, hasDataQualityIssues })).toEqual({
      hasDataQualityIssues: answer,
    });
  });

  it.each([
    ['yes', true],
    ['no', false],
  ] as const)('writes %s as %s', (hasDataQualityIssues, answer) => {
    expect(dataQualityColumns.toAttributes({ hasDataQualityIssues })).toEqual({
      hasDataQualityIssues: answer,
    });
  });
});

describe('updateFrequencyColumns', () => {
  it('reads and writes the column of the same name', () => {
    const answers = { updateFrequency: 'no-longer-updated' } as const;

    expect(updateFrequencyColumns.fromDraft({ ...unansweredDraft, ...answers })).toEqual(answers);
    expect(updateFrequencyColumns.toAttributes(answers)).toEqual(answers);
  });
});

describe('periodTypeColumns', () => {
  const years = 'years';
  const specified = 'specified-end-date';

  it('reads the year end as the form gives it', () => {
    expect(
      periodTypeColumns.fromDraft({
        ...unansweredDraft,
        periodType: years,
        yearType: specified,
        yearEndDay: 31,
        yearEndMonth: 7,
      }),
    ).toEqual({ periodType: years, yearType: specified, yearEndDay: '31', yearEndMonth: '7' });
  });

  it('writes the year end of a year ending on a specified date', () => {
    expect(
      periodTypeColumns.toAttributes({
        periodType: years,
        yearType: specified,
        yearEndDay: '31',
        yearEndMonth: '07',
      }),
    ).toEqual({ periodType: years, yearType: specified, yearEndDay: 31, yearEndMonth: 7 });
  });

  it('clears a year end the year type does not ask for', () => {
    expect(
      periodTypeColumns.toAttributes({
        periodType: 'quarters',
        yearType: 'financial',
        yearEndDay: '31',
        yearEndMonth: '7',
      }),
    ).toEqual({
      periodType: 'quarters',
      yearType: 'financial',
      yearEndDay: null,
      yearEndMonth: null,
    });
  });

  it('clears the year type and year end of months', () => {
    expect(
      periodTypeColumns.toAttributes({
        periodType: 'months',
        yearType: specified,
        yearEndDay: '31',
        yearEndMonth: '7',
      }),
    ).toEqual({
      periodType: 'months',
      yearType: null,
      yearEndDay: null,
      yearEndMonth: null,
    });
  });
});

describe('valueTypeAndUnitsColumns', () => {
  const DSR = VALUE_TYPE_IDS.directlyStandardisedRate;
  const ISR = VALUE_TYPE_IDS.indirectlyStandardisedRatio;
  // Every follow-up filled in, as a form without JavaScript may send them.
  const everyFollowUp = {
    standardPopulation: 'other',
    standardPopulationOther: 'England 2021',
    referencePopulation: 'England 2019',
    unitDetail: 'people',
  } as const;

  it.each([
    [
      'the 2013 European Standard Population alone beside a directly standardised rate',
      {
        valueTypeId: DSR,
        standardPopulation: 'esp-2013',
        unitId: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9',
      },
      { standardPopulation: 'esp-2013', standardPopulationDetail: null, unitDetail: null },
    ],
    [
      'an other standard population with its detail',
      { valueTypeId: DSR, unitId: '01a0d8a5-3ca2-7315-bfca-96daa0c93ee9' },
      { standardPopulation: 'other', standardPopulationDetail: 'England 2021', unitDetail: null },
    ],
    [
      'the reference population beside an indirectly standardised value type',
      { valueTypeId: ISR, unitId: '01a0d8a5-3ca2-7315-bfca-96d787920e40' },
      { standardPopulation: null, standardPopulationDetail: 'England 2019', unitDetail: null },
    ],
    [
      'no population beside any other value type, and an other unit with its name',
      { valueTypeId: '01a0d8a5-3ca2-7315-bfca-96c7324d4347', unitId: UNIT_IDS.other },
      { standardPopulation: null, standardPopulationDetail: null, unitDetail: 'people' },
    ],
  ] as const)('writes %s, clearing what is not asked', (_, answers, attributes) => {
    expect(valueTypeAndUnitsColumns.toAttributes({ ...everyFollowUp, ...answers })).toEqual({
      valueTypeId: answers.valueTypeId,
      unitId: answers.unitId,
      ...attributes,
    });
  });

  it.each([
    [
      'an other standard population',
      { valueTypeId: DSR, standardPopulation: 'other', standardPopulationDetail: 'England 2021' },
      { standardPopulationOther: 'England 2021', referencePopulation: null },
    ],
    [
      'a reference population',
      { valueTypeId: ISR, standardPopulationDetail: 'England 2019' },
      { standardPopulationOther: null, referencePopulation: 'England 2019' },
    ],
  ] as const)('reads %s back into its own field', (_, draft, answers) => {
    expect(valueTypeAndUnitsColumns.fromDraft({ ...unansweredDraft, ...draft })).toMatchObject(
      answers,
    );
  });
});

describe('calculationColumns', () => {
  it('keeps the other organisations beside "other"', () => {
    const answers = {
      methodology: 'A method',
      calculatedBy: 'other',
      calculatedByDetail: 'ONS',
    } as const;

    expect(calculationColumns.fromDraft({ ...unansweredDraft, ...answers })).toEqual(answers);
    expect(calculationColumns.toAttributes(answers)).toEqual(answers);
  });

  it.each(['ohid', 'dhsc'] as const)(
    'clears the other organisations when %s calculated it',
    (calculatedBy) => {
      expect(
        calculationColumns.toAttributes({
          methodology: 'A method',
          calculatedBy,
          calculatedByDetail: 'Left from before',
        }),
      ).toEqual({ methodology: 'A method', calculatedBy, calculatedByDetail: null });
    },
  );
});

describe('confidenceIntervalsColumns', () => {
  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads a modifications answer of %s as %s', (hasCiMethodModifications, answer) => {
    expect(
      confidenceIntervalsColumns.fromDraft({ ...unansweredDraft, hasCiMethodModifications })
        .hasCiMethodModifications,
    ).toBe(answer);
  });

  it.each([
    [
      'an unmodified standard method, clearing the answers it does not ask for',
      { kind: 'standard', hasCiMethodModifications: 'no' },
      { hasCiMethodModifications: false, ciMethodModificationsDetail: null, ciMethodDetail: null },
    ],
    [
      "a modified standard method with its modifications' description",
      { kind: 'standard' },
      {
        hasCiMethodModifications: true,
        ciMethodModificationsDetail: 'Adjusted for clustering',
        ciMethodDetail: null,
      },
    ],
    [
      'an other method with its detail, clearing the modifications',
      { kind: 'other' },
      {
        hasCiMethodModifications: null,
        ciMethodModificationsDetail: null,
        ciMethodDetail: 'Bootstrap intervals',
      },
    ],
    [
      'a method with nothing to describe alone, clearing every follow-up',
      { kind: 'none' },
      { hasCiMethodModifications: null, ciMethodModificationsDetail: null, ciMethodDetail: null },
    ],
  ] as const)('writes %s', (_, answers, attributes) => {
    expect(
      confidenceIntervalsColumns.toAttributes({
        ciMethodId: METHODS.standard.id,
        ...everyAnswer,
        ...answers,
      }),
    ).toEqual({ ciMethodId: METHODS.standard.id, ...attributes });
  });
});

describe('otherNotesAndCaveatsColumns', () => {
  const answered = {
    disclosureControl: 'yes',
    disclosureControlDetail: 'Counts under 5 are suppressed.',
    hasRounding: 'yes',
    roundingDetail: 'Rounded to the nearest 5.',
    hasCaveats: 'yes',
    caveatsDetail: 'Survey data.',
    hasOtherNotes: 'yes',
    otherNotesDetail: 'Revised in 2024.',
  } as const;

  it('keeps every detail beside a yes', () => {
    expect(otherNotesAndCaveatsColumns.toAttributes(answered)).toEqual({
      ...answered,
      hasRounding: true,
      hasCaveats: true,
      hasOtherNotes: true,
    });
  });

  it.each(['no', 'not-applicable'] as const)(
    'clears every detail beside a no, and disclosure control that is %s',
    (disclosureControl) => {
      expect(
        otherNotesAndCaveatsColumns.toAttributes({
          ...answered,
          disclosureControl,
          hasRounding: 'no',
          hasCaveats: 'no',
          hasOtherNotes: 'no',
        }),
      ).toEqual({
        disclosureControl,
        disclosureControlDetail: null,
        hasRounding: false,
        roundingDetail: null,
        hasCaveats: false,
        caveatsDetail: null,
        hasOtherNotes: false,
        otherNotesDetail: null,
      });
    },
  );

  it('reads the stored answers back as the form gives them', () => {
    expect(
      otherNotesAndCaveatsColumns.fromDraft({
        ...unansweredDraft,
        ...answered,
        hasRounding: true,
        hasCaveats: true,
        hasOtherNotes: true,
      }),
    ).toEqual(answered);
  });

  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads a stored %s as %s', (hasRounding, answer) => {
    expect(
      otherNotesAndCaveatsColumns.fromDraft({ ...unansweredDraft, hasRounding }).hasRounding,
    ).toBe(answer);
  });
});

// yesNoDetailColumns, shown through the first section built on it alone.
describe('varianceAndQualityColumns', () => {
  const answered = {
    variation: 'Varies by area.',
    qualityAssurance: 'Checked against ONS figures.',
    hasSourceDataIssues: 'yes',
    sourceDataIssuesDetail: 'Late returns.',
  } as const;

  it('writes the text as it is, and a yes as true beside its details', () => {
    expect(varianceAndQualityColumns.toAttributes(answered)).toEqual({
      ...answered,
      hasSourceDataIssues: true,
    });
  });

  it('writes a no as false and clears its details', () => {
    expect(
      varianceAndQualityColumns.toAttributes({ ...answered, hasSourceDataIssues: 'no' }),
    ).toEqual({ ...answered, hasSourceDataIssues: false, sourceDataIssuesDetail: null });
  });

  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads a stored %s as %s, beside the text as it is', (hasSourceDataIssues, answer) => {
    expect(
      varianceAndQualityColumns.fromDraft({
        ...unansweredDraft,
        ...answered,
        hasSourceDataIssues,
      }),
    ).toEqual({ ...answered, hasSourceDataIssues: answer });
  });
});

describe('justificationsColumns', () => {
  const answered = {
    ciMethodJustification: 'The standard method for rates.',
    dataSourcesJustification: 'The only national source.',
    inequalitiesIncluded: 'Deprivation deciles.',
    hasExclusions: 'yes',
    exclusionsDetail: 'Areas with fewer than 5 deaths.',
    hasAutomation: 'no',
    automationDetail: 'Typed before No was chosen.',
  } as const;

  it('keeps the details of a yes and clears those of a no', () => {
    expect(justificationsColumns.toAttributes(answered)).toEqual({
      ...answered,
      hasExclusions: true,
      hasAutomation: false,
      automationDetail: null,
    });
  });

  it('reads the stored answers back as the form gives them', () => {
    expect(
      justificationsColumns.fromDraft({
        ...unansweredDraft,
        ...answered,
        hasExclusions: true,
        hasAutomation: false,
        automationDetail: null,
      }),
    ).toEqual({ ...answered, automationDetail: null });
  });
});

describe('otherCommentsColumns', () => {
  const answered = {
    sponsorsAndStakeholders: 'The national screening committee.',
    hasReviewerComments: 'yes',
    reviewerCommentsDetail: 'Replaces indicator 108.',
  } as const;

  it('keeps the comments beside a yes', () => {
    expect(otherCommentsColumns.toAttributes(answered)).toEqual({
      ...answered,
      hasReviewerComments: true,
    });
  });

  it('clears the comments beside a no', () => {
    expect(otherCommentsColumns.toAttributes({ ...answered, hasReviewerComments: 'no' })).toEqual({
      ...answered,
      hasReviewerComments: false,
      reviewerCommentsDetail: null,
    });
  });

  it('writes blank sponsors and stakeholders as none', () => {
    expect(
      otherCommentsColumns.toAttributes({ ...answered, sponsorsAndStakeholders: '' })
        .sponsorsAndStakeholders,
    ).toBeNull();
  });

  it('reads the stored answers back as the form gives them', () => {
    expect(
      otherCommentsColumns.fromDraft({
        ...unansweredDraft,
        ...answered,
        hasReviewerComments: true,
      }),
    ).toEqual(answered);
  });
});

describe('benchmarkingColumns', () => {
  const goal = {
    hasGoalBenchmark: 'yes',
    goalLowerValue: '2,400',
    goalUpperValue: '3250.5',
    goalPolarity: 'higher-is-better',
    goalPolicyDetail: 'The national detection rate ambition.',
  } as const;

  const noGoal = {
    hasGoalBenchmark: false,
    goalLowerValue: null,
    goalUpperValue: null,
    goalPolarity: null,
    goalPolicyDetail: null,
  };

  it('writes a goal with its values as numbers', () => {
    expect(benchmarkingColumns.toAttributes(goal)).toEqual({
      hasGoalBenchmark: true,
      goalLowerValue: 2400,
      goalUpperValue: 3250.5,
      goalPolarity: 'higher-is-better',
      goalPolicyDetail: 'The national detection rate ambition.',
    });
  });

  it('writes a single goal value and a blank detail as none', () => {
    expect(
      benchmarkingColumns.toAttributes({ ...goal, goalUpperValue: '', goalPolicyDetail: '' }),
    ).toMatchObject({ goalUpperValue: null, goalPolicyDetail: null });
  });

  it('writes no goal and clears whatever the form sent beside it', () => {
    expect(benchmarkingColumns.toAttributes({ ...goal, hasGoalBenchmark: 'no' })).toEqual(noGoal);
  });

  it('reads a goal back as the form shows it', () => {
    expect(
      benchmarkingColumns.fromDraft({
        ...unansweredDraft,
        hasGoalBenchmark: true,
        goalLowerValue: 2400,
        goalUpperValue: 1e21,
        goalPolarity: 'lower-is-better',
        goalPolicyDetail: null,
      }),
    ).toEqual({
      hasGoalBenchmark: 'yes',
      goalLowerValue: '2400',
      goalUpperValue: '1000000000000000000000',
      goalPolarity: 'lower-is-better',
      goalPolicyDetail: null,
    });
  });

  it.each([
    [false, 'no'],
    [null, null],
  ])('reads a stored %s as %s', (hasGoalBenchmark, answer) => {
    expect(benchmarkingColumns.fromDraft({ ...unansweredDraft, hasGoalBenchmark })).toEqual({
      hasGoalBenchmark: answer,
      goalLowerValue: null,
      goalUpperValue: null,
      goalPolarity: null,
      goalPolicyDetail: null,
    });
  });
});

describe('linksColumns', () => {
  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads whether there are links, %s, as %s', (hasLinks, answer) => {
    expect(linksColumns.fromDraft({ ...unansweredDraft, hasLinks }).hasLinks).toBe(answer);
  });

  it('reads the links in the order they are held', () => {
    expect(linksColumns.fromDraft({ ...unansweredDraft, hasLinks: true, links }).links).toEqual(
      links,
    );
  });

  it('writes the links beside "Yes"', () => {
    expect(linksColumns.toAttributes({ hasLinks: 'yes', links })).toEqual({ hasLinks: true });
    expect(linksColumns.toLists?.({ hasLinks: 'yes', links })).toEqual({ links });
  });

  it('clears the links beside "No"', () => {
    expect(linksColumns.toAttributes({ hasLinks: 'no', links })).toEqual({ hasLinks: false });
    expect(linksColumns.toLists?.({ hasLinks: 'no', links })).toEqual({ links: [] });
  });
});

describe('sexAndAgesColumns', () => {
  // Every age type's answers filled in, as a form without JavaScript may send them.
  const everyAnswer = (ageType: SexAndAges['ageType']): SexAndAges => ({
    sexes: ['females', 'males'],
    ageType,
    ageRanges: [{ lowerLimit: '16', lowerLimitUnit: 'years', upperLimit: '', upperLimitUnit: '' }],
    specificAge: '5',
    specificAgeUnit: 'weeks',
    ageDetail: 'School year 6',
  });

  it('reads unanswered sexes as none', () => {
    expect(sexAndAgesColumns.fromDraft(unansweredDraft)).toEqual({
      sexes: [],
      ageType: null,
      ageRanges: [],
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: null,
    });
  });

  it('writes the ranges, with each limit left empty as null, and nothing else beside a range', () => {
    const values = everyAnswer('range');

    expect(sexAndAgesColumns.toAttributes(values)).toEqual({
      sexes: ['females', 'males'],
      ageType: 'range',
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: null,
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({
      ageRanges: [
        { lowerLimit: 16, lowerLimitUnit: 'years', upperLimit: null, upperLimitUnit: null },
      ],
    });
  });

  it('writes the specific age as a number, and nothing else beside it', () => {
    const values = everyAnswer('specific');

    expect(sexAndAgesColumns.toAttributes(values)).toMatchObject({
      specificAge: 5,
      specificAgeUnit: 'weeks',
      ageDetail: null,
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({ ageRanges: [] });
  });

  it('writes all ages, and nothing else beside them', () => {
    const values = everyAnswer('all');

    expect(sexAndAgesColumns.toAttributes(values)).toEqual({
      sexes: ['females', 'males'],
      ageType: 'all',
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: null,
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({ ageRanges: [] });
  });

  it('writes the other ages, and nothing else beside them', () => {
    const values = everyAnswer('other');

    expect(sexAndAgesColumns.toAttributes(values)).toMatchObject({
      specificAge: null,
      specificAgeUnit: null,
      ageDetail: 'School year 6',
    });
    expect(sexAndAgesColumns.toLists?.(values)).toEqual({ ageRanges: [] });
  });
});

const TAGS = {
  topic: '019fa38f-073f-764e-9ac6-1c4d03b10001',
  otherTopic: '019fa38f-073f-764e-9ac6-1c4d03b10002',
  type: '019fa38f-073f-764e-9ac6-1c4d03b10003',
  riskFactor: '019fa38f-073f-764e-9ac6-1c4d03b10004',
  framework: '019fa38f-073f-764e-9ac6-1c4d03b10005',
};

const tagOptions: TagOptions = {
  topics: [
    { id: TAGS.topic, name: 'Alcohol' },
    { id: TAGS.otherTopic, name: 'Cancer' },
  ],
  indicatorTypes: [{ id: TAGS.type, name: 'Outcome' }],
  riskFactors: [{ id: TAGS.riskFactor, name: 'Alcohol' }],
  frameworks: [{ id: TAGS.framework, name: 'Healthy Child' }],
};

const tagging: Tagging = {
  topicIds: [TAGS.otherTopic, TAGS.topic],
  indicatorTypeIds: [TAGS.type],
  hasRiskFactor: 'yes',
  riskFactorIds: [TAGS.riskFactor],
  hasFramework: 'no',
  frameworkIds: [],
};

describe('taggingColumns', () => {
  it('reads each dimension of the classifications as its own list', () => {
    expect(
      taggingColumns.fromDraft({
        ...unansweredDraft,
        hasRiskFactor: true,
        hasFramework: false,
        topicIds: [TAGS.topic],
        classifications: [
          { id: TAGS.framework, dimension: 'framework' },
          { id: TAGS.type, dimension: 'indicator_type' },
          { id: '019fa38f-073f-764e-9ac6-1c4d03b10006', dimension: 'population' },
          { id: TAGS.riskFactor, dimension: 'risk_factor' },
        ],
      }),
    ).toEqual({
      topicIds: [TAGS.topic],
      indicatorTypeIds: [TAGS.type],
      hasRiskFactor: 'yes',
      riskFactorIds: [TAGS.riskFactor],
      hasFramework: 'no',
      frameworkIds: [TAGS.framework],
    });
  });

  it('writes the answers and replaces only the dimensions the page asks about', () => {
    expect(taggingColumns.toAttributes(tagging)).toEqual({
      hasRiskFactor: true,
      hasFramework: false,
    });
    expect(taggingColumns.toLists?.(tagging)).toEqual({
      topicIds: [TAGS.otherTopic, TAGS.topic],
      classificationIds: {
        indicator_type: [TAGS.type],
        risk_factor: [TAGS.riskFactor],
        framework: [],
      },
    });
  });

  it('drops the tags beside a "No", whatever the form sent', () => {
    const sent: Tagging = {
      ...tagging,
      hasRiskFactor: 'no',
      hasFramework: 'no',
      frameworkIds: [TAGS.framework],
    };

    expect(taggingColumns.toLists?.(sent)).toMatchObject({
      classificationIds: { risk_factor: [], framework: [] },
    });
  });
});

describe('taggingServerSection', () => {
  async function fieldErrorsOf(body: object) {
    const { tags } = createFakeInternalRepositories({
      tags: { listOptions: vi.fn().mockResolvedValue(tagOptions) },
    });
    const section = taggingServerSection(tags);
    const result = await section.schema.safeParseAsync(body);
    return result.success ? undefined : toFieldErrors(result.error, section.fields);
  }

  it('accepts tags the page offers', async () => {
    expect(await fieldErrorsOf(tagging)).toBeUndefined();
  });

  it('refuses a tag offered under another question, or not at all', async () => {
    expect(
      await fieldErrorsOf({
        ...tagging,
        topicIds: [TAGS.type],
        riskFactorIds: ['019fa38f-073f-764e-9ac6-1c4d03b10999'],
        hasFramework: 'yes',
        frameworkIds: [TAGS.topic],
      }),
    ).toEqual({
      topicIds: 'Select a topic from the list',
      riskFactorIds: 'Select a risk factor from the list',
      frameworkIds: 'Select a framework or programme from the list',
    });
  });

  it('does not judge the tags beside a "No", which are dropped', async () => {
    expect(
      await fieldErrorsOf({ ...tagging, hasRiskFactor: 'no', riskFactorIds: [TAGS.topic] }),
    ).toBeUndefined();
  });
});

describe('confidenceIntervalsServerSection', () => {
  function submit(
    body: object,
    findById = vi.fn(async (id: string) =>
      Object.values(METHODS).find((method) => method.id === id),
    ),
  ) {
    const { ciMethods } = createFakeInternalRepositories({ ciMethods: { findById } });
    const section = confidenceIntervalsServerSection(ciMethods);

    return { findById, submission: section.schema.safeParseAsync(body), section };
  }

  async function fieldErrorsOf(body: object) {
    const { section, submission } = submit(body);
    const result = await submission;
    return result.success ? undefined : toFieldErrors(result.error, section.fields);
  }

  it('adds the kind of the chosen method', async () => {
    const result = await submit({ ...everyAnswer, ciMethodId: METHODS.other.id }).submission;

    expect(result.success && result.data.kind).toBe('other');
  });

  it('refuses a method that does not exist', async () => {
    expect(
      await fieldErrorsOf({ ...everyAnswer, ciMethodId: '00000000-0000-7000-8000-000000000999' }),
    ).toEqual({ ciMethodId: 'Select the confidence interval method used' });
  });

  it('refuses an unchosen method without looking for it', async () => {
    const { findById, submission } = submit({ ...everyAnswer, ciMethodId: '' });

    expect((await submission).success).toBe(false);
    expect(findById).not.toHaveBeenCalled();
  });

  it("refuses what the chosen method's kind asks for and was not given", async () => {
    expect(
      await fieldErrorsOf({
        ciMethodId: METHODS.standard.id,
        hasCiMethodModifications: '',
        ciMethodModificationsDetail: '',
        ciMethodDetail: '',
      }),
    ).toEqual({ hasCiMethodModifications: 'Select whether any modifications were used' });
  });
});

describe('valueTypeAndUnitsServerSection', () => {
  const options = {
    valueTypes: [{ id: '01a0d8a5-3ca2-7315-bfca-96d2031a65e7', name: 'Proportion' }],
    units: [{ id: '01a0d8a5-3ca2-7315-bfca-96d615820bd4', name: '%' }],
  };
  const answers = {
    valueTypeId: '01a0d8a5-3ca2-7315-bfca-96d2031a65e7',
    standardPopulation: '',
    standardPopulationOther: '',
    referencePopulation: '',
    unitId: '01a0d8a5-3ca2-7315-bfca-96d615820bd4',
    unitDetail: '',
  };

  function submit(body: object) {
    const listOptions = vi.fn().mockResolvedValue(options);
    const { valueTypesAndUnits } = createFakeInternalRepositories({
      valueTypesAndUnits: { listOptions },
    });
    const section = valueTypeAndUnitsServerSection(valueTypesAndUnits);

    return { listOptions, section, submission: section.schema.safeParseAsync(body) };
  }

  async function fieldErrorsOf(body: object) {
    const { section, submission } = submit(body);
    const result = await submission;
    return result.success ? undefined : toFieldErrors(result.error, section.fields);
  }

  it('accepts a value type and unit the page offers', async () => {
    expect(await fieldErrorsOf(answers)).toBeUndefined();
  });

  it('refuses a value type or unit the page does not offer', async () => {
    const missing = '00000000-0000-7000-8000-000000000999';

    expect(await fieldErrorsOf({ ...answers, valueTypeId: missing, unitId: missing })).toEqual({
      valueTypeId: 'Select the value type',
      unitId: 'Select the units',
    });
  });

  it('refuses an unchosen value type without reading the options', async () => {
    const { listOptions, submission } = submit({ ...answers, valueTypeId: '' });

    expect((await submission).success).toBe(false);
    expect(listOptions).not.toHaveBeenCalled();
  });
});

const publishingDate = {
  publishingDateDay: '14',
  publishingDateMonth: '9',
  publishingDateYear: '2027',
  publishingTimeHour: '09',
  publishingTimeMinute: '30',
};

describe('publishingDateColumns', () => {
  it.each([
    ['in BST', '2027-09-14T08:30:00.000Z', publishingDate],
    [
      'in GMT, as the clock showed it',
      '2027-01-04T15:05:00.000Z',
      {
        publishingDateDay: '4',
        publishingDateMonth: '1',
        publishingDateYear: '2027',
        publishingTimeHour: '15',
        publishingTimeMinute: '05',
      },
    ],
  ])('reads a scheduled publication %s as its UK date and time', (_, instant, answers) => {
    const draft = { ...unansweredDraft, scheduledPublishAt: new Date(instant) };

    expect(publishingDateColumns.fromDraft(draft)).toEqual(answers);
  });

  it('reads an unscheduled publication as unanswered', () => {
    expect(Object.values(publishingDateColumns.fromDraft(unansweredDraft))).toEqual(
      Array(5).fill(null),
    );
  });

  it('writes the instant the answers name', () => {
    const scheduledPublishAt = new Date('2027-09-14T08:30:00.000Z');

    expect(publishingDateColumns.toAttributes({ ...publishingDate, scheduledPublishAt })).toEqual({
      scheduledPublishAt,
    });
  });
});

describe('publishingDateServerSection', () => {
  // 09:30 BST on 14 September 2027.
  const now = new Date('2027-09-14T08:30:00.000Z');

  function submit(body: object, at: Date = now) {
    return publishingDateServerSection(() => at).schema.safeParse(body);
  }

  function fieldErrorsOf(body: object, at: Date = now) {
    const result = submit(body, at);
    return result.success ? undefined : toFieldErrors(result.error, publishingDateSection.fields);
  }

  function dated(day: string, month: string, year = '2027') {
    return {
      ...publishingDate,
      publishingDateDay: day,
      publishingDateMonth: month,
      publishingDateYear: year,
    };
  }

  it('adds the instant the UK date and time name, 28 days ahead', () => {
    const result = submit(dated('12', '10'));

    expect(result.success && result.data.scheduledPublishAt).toEqual(
      new Date('2027-10-12T08:30:00.000Z'),
    );
  });

  it.each([
    ['27 days from today', dated('11', '10')],
    ['today', dated('14', '9')],
    ['in the past', dated('13', '9')],
  ])('refuses a date %s, on the parts of the date', (_, body) => {
    const message = 'Publishing date must be at least 28 days from today';

    expect(fieldErrorsOf(body)).toEqual({
      publishingDateDay: message,
      publishingDateMonth: message,
      publishingDateYear: message,
    });
  });

  it('accepts any time on the date 28 days from today', () => {
    // Less than 28 × 24 hours after 09:30 on 14 September.
    const midnight = { ...dated('12', '10'), publishingTimeHour: '00', publishingTimeMinute: '00' };

    expect(submit(midnight).success).toBe(true);
  });

  it("counts from today's date in the UK", () => {
    // 00:30 BST on 15 September, still 14 September in UTC.
    const lateEvening = new Date('2027-09-14T23:30:00.000Z');

    expect(fieldErrorsOf(dated('12', '10'), lateEvening)).toBeDefined();
    expect(submit(dated('13', '10'), lateEvening).success).toBe(true);
  });

  it('counts calendar days across a clock change', () => {
    // 09:30 GMT on 5 March; 09:30 BST on 2 April is an hour short of 28 × 24 hours later.
    const march = new Date('2027-03-05T09:30:00.000Z');

    expect(submit(dated('2', '4'), march).success).toBe(true);
  });

  it('refuses a time the spring clock change skips, on the parts of the time', () => {
    const skipped = { ...dated('26', '3', '2028'), publishingTimeHour: '01' };

    expect(fieldErrorsOf(skipped)).toEqual({
      publishingTimeHour: 'Publishing time must be a real time',
      publishingTimeMinute: 'Publishing time must be a real time',
    });
  });

  it('takes a time the autumn clock change repeats as its second, GMT, occurrence', () => {
    const repeated = { ...dated('29', '10', '2028'), publishingTimeHour: '01' };
    const result = submit(repeated);

    expect(result.success && result.data.scheduledPublishAt).toEqual(
      new Date('2028-10-29T01:30:00.000Z'),
    );
  });
});

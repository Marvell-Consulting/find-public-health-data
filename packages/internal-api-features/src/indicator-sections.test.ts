import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { CiMethodRow } from './ci-method-repository.ts';
import { indicatorTaskKeySchema, toFieldErrors } from './contract.ts';
import type { IndicatorSectionDraft } from './indicator-section.ts';
import {
  calculationColumns,
  confidenceIntervalsColumns,
  confidenceIntervalsServerSection,
  definitionAndRationaleColumns,
  indicatorSectionsRouter,
  linksColumns,
  otherNotesAndCaveatsColumns,
  polarityColumns,
  publishingDateColumns,
  publishingDateServerSection,
  updateFrequencyColumns,
  varianceAndQualityColumns,
} from './indicator-sections.ts';
import {
  createFakeInternalRepositories,
  createRouterTestApp,
  testSessionCookie,
  testSessionVerifier,
} from './testing.ts';

// The HTTP behaviour every section shares is tested in indicator-section.test.ts.

const unanswered: IndicatorSectionDraft = {
  definition: null,
  rationale: null,
  polarity: null,
  methodology: null,
  calculatedBy: null,
  calculatedByOther: null,
  ciMethodId: null,
  ciMethodModified: null,
  ciMethodModifications: null,
  ciMethodOtherDetail: null,
  updateFrequency: null,
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
};

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
  ciMethodModified: 'yes',
  ciMethodModifications: 'Adjusted for clustering',
  ciMethodOtherDetail: 'Bootstrap intervals',
} as const;

describe('indicatorSectionsRouter', () => {
  const sectionKeys = indicatorTaskKeySchema.options.filter((key) => key !== 'name');

  it.each(sectionKeys)(
    'serves the %s section, answering every unanswered field as null and every list as empty',
    async (key) => {
      const repositories = createFakeInternalRepositories({
        indicators: { findDraftState: vi.fn().mockResolvedValue({ draft: unanswered }) },
      });

      const response = await request(
        createRouterTestApp(indicatorSectionsRouter(repositories, testSessionVerifier)),
      )
        .get(`/api/internal/indicators/00000000-0000-7000-8000-000000000001/${key}`)
        .set('Cookie', await testSessionCookie(['internal', 'publisher']));

      expect(response.status).toBe(200);
      expect(
        Object.values(response.body).every(
          (answer) => answer === null || (Array.isArray(answer) && answer.length === 0),
        ),
      ).toBe(true);
    },
  );

  it('writes the lists a section gives beside its columns', async () => {
    const updateDraft = vi.fn().mockResolvedValue({ ok: true });
    const repositories = createFakeInternalRepositories({
      indicators: {
        updateDraft,
        findDraftState: vi
          .fn()
          .mockResolvedValue({ draft: { ...unanswered, hasLinks: true, links } }),
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

    expect(definitionAndRationaleColumns.fromDraft({ ...unanswered, ...answers })).toEqual(answers);
    expect(definitionAndRationaleColumns.toAttributes(answers)).toEqual(answers);
  });
});

describe('polarityColumns', () => {
  it('reads and writes the column of the same name', () => {
    expect(polarityColumns.fromDraft({ ...unanswered, polarity: 'no-polarity' })).toEqual({
      polarity: 'no-polarity',
    });
    expect(polarityColumns.toAttributes({ polarity: 'no-polarity' })).toEqual({
      polarity: 'no-polarity',
    });
  });
});

describe('updateFrequencyColumns', () => {
  it('reads and writes the column of the same name', () => {
    const answers = { updateFrequency: 'no-longer-updated' } as const;

    expect(updateFrequencyColumns.fromDraft({ ...unanswered, ...answers })).toEqual(answers);
    expect(updateFrequencyColumns.toAttributes(answers)).toEqual(answers);
  });
});

describe('calculationColumns', () => {
  it('keeps the other organisations beside "other"', () => {
    const answers = {
      methodology: 'A method',
      calculatedBy: 'other',
      calculatedByOther: 'ONS',
    } as const;

    expect(calculationColumns.fromDraft({ ...unanswered, ...answers })).toEqual(answers);
    expect(calculationColumns.toAttributes(answers)).toEqual(answers);
  });

  it.each(['ohid', 'dhsc'] as const)(
    'clears the other organisations when %s calculated it',
    (calculatedBy) => {
      expect(
        calculationColumns.toAttributes({
          methodology: 'A method',
          calculatedBy,
          calculatedByOther: 'Left from before',
        }),
      ).toEqual({ methodology: 'A method', calculatedBy, calculatedByOther: null });
    },
  );
});

describe('confidenceIntervalsColumns', () => {
  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads a modifications answer of %s as %s', (ciMethodModified, answer) => {
    expect(
      confidenceIntervalsColumns.fromDraft({ ...unanswered, ciMethodModified }).ciMethodModified,
    ).toBe(answer);
  });

  it.each([
    [
      'an unmodified standard method, clearing the answers it does not ask for',
      { kind: 'standard', ciMethodModified: 'no' },
      { ciMethodModified: false, ciMethodModifications: null, ciMethodOtherDetail: null },
    ],
    [
      "a modified standard method with its modifications' description",
      { kind: 'standard' },
      {
        ciMethodModified: true,
        ciMethodModifications: 'Adjusted for clustering',
        ciMethodOtherDetail: null,
      },
    ],
    [
      'an other method with its detail, clearing the modifications',
      { kind: 'other' },
      {
        ciMethodModified: null,
        ciMethodModifications: null,
        ciMethodOtherDetail: 'Bootstrap intervals',
      },
    ],
    [
      'a method with nothing to describe alone, clearing every follow-up',
      { kind: 'none' },
      { ciMethodModified: null, ciMethodModifications: null, ciMethodOtherDetail: null },
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
    roundingApplied: 'yes',
    roundingDetail: 'Rounded to the nearest 5.',
    caveatsNeeded: 'yes',
    caveatsDetail: 'Survey data.',
    otherNotesNeeded: 'yes',
    otherNotesDetail: 'Revised in 2024.',
  } as const;

  it('keeps every detail beside a yes', () => {
    expect(otherNotesAndCaveatsColumns.toAttributes(answered)).toEqual({
      ...answered,
      roundingApplied: true,
      caveatsNeeded: true,
      otherNotesNeeded: true,
    });
  });

  it.each(['no', 'not-applicable'] as const)(
    'clears every detail beside a no, and disclosure control that is %s',
    (disclosureControl) => {
      expect(
        otherNotesAndCaveatsColumns.toAttributes({
          ...answered,
          disclosureControl,
          roundingApplied: 'no',
          caveatsNeeded: 'no',
          otherNotesNeeded: 'no',
        }),
      ).toEqual({
        disclosureControl,
        disclosureControlDetail: null,
        roundingApplied: false,
        roundingDetail: null,
        caveatsNeeded: false,
        caveatsDetail: null,
        otherNotesNeeded: false,
        otherNotesDetail: null,
      });
    },
  );

  it('reads the stored answers back as the form gives them', () => {
    expect(
      otherNotesAndCaveatsColumns.fromDraft({
        ...unanswered,
        ...answered,
        roundingApplied: true,
        caveatsNeeded: true,
        otherNotesNeeded: true,
      }),
    ).toEqual(answered);
  });

  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads a stored %s as %s', (roundingApplied, answer) => {
    expect(
      otherNotesAndCaveatsColumns.fromDraft({ ...unanswered, roundingApplied }).roundingApplied,
    ).toBe(answer);
  });
});

// yesNoDetailColumns, shown through the first section built on it alone.
describe('varianceAndQualityColumns', () => {
  const answered = {
    variation: 'Varies by area.',
    qualityAssurance: 'Checked against ONS figures.',
    sourceDataIssues: 'yes',
    sourceDataIssuesDetail: 'Late returns.',
  } as const;

  it('writes the text as it is, and a yes as true beside its details', () => {
    expect(varianceAndQualityColumns.toAttributes(answered)).toEqual({
      ...answered,
      sourceDataIssues: true,
    });
  });

  it('writes a no as false and clears its details', () => {
    expect(varianceAndQualityColumns.toAttributes({ ...answered, sourceDataIssues: 'no' })).toEqual(
      { ...answered, sourceDataIssues: false, sourceDataIssuesDetail: null },
    );
  });

  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads a stored %s as %s, beside the text as it is', (sourceDataIssues, answer) => {
    expect(
      varianceAndQualityColumns.fromDraft({
        ...unanswered,
        ...answered,
        sourceDataIssues,
      }),
    ).toEqual({ ...answered, sourceDataIssues: answer });
  });
});

describe('linksColumns', () => {
  it.each([
    [true, 'yes'],
    [false, 'no'],
    [null, null],
  ])('reads whether there are links, %s, as %s', (hasLinks, answer) => {
    expect(linksColumns.fromDraft({ ...unanswered, hasLinks }).hasLinks).toBe(answer);
  });

  it('reads the links in the order they are held', () => {
    expect(linksColumns.fromDraft({ ...unanswered, hasLinks: true, links }).links).toEqual(links);
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
    return result.success ? undefined : toFieldErrors(result.error, section.fields.options);
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
        ciMethodModified: '',
        ciMethodModifications: '',
        ciMethodOtherDetail: '',
      }),
    ).toEqual({ ciMethodModified: 'Select whether any modifications were used' });
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
    ['in BST', '2027-09-14T09:30:00+01:00', publishingDate],
    [
      'in GMT, as the clock showed it',
      '2027-01-04T15:05:00+00:00',
      {
        publishingDateDay: '4',
        publishingDateMonth: '1',
        publishingDateYear: '2027',
        publishingTimeHour: '15',
        publishingTimeMinute: '05',
      },
    ],
  ])(
    'reads a scheduled publication %s as its UK date and time',
    (_, scheduledPublishAtUk, answers) => {
      expect(publishingDateColumns.fromDraft({ ...unanswered, scheduledPublishAtUk })).toEqual(
        answers,
      );
    },
  );

  it('reads an unscheduled publication as unanswered', () => {
    expect(Object.values(publishingDateColumns.fromDraft(unanswered))).toEqual(Array(5).fill(null));
  });

  it('writes the instant the answers name', () => {
    expect(
      publishingDateColumns.toAttributes({
        ...publishingDate,
        scheduledPublishAt: '2027-09-14T09:30:00+01:00',
      }),
    ).toEqual({ scheduledPublishAt: new Date('2027-09-14T08:30:00.000Z') });
  });
});

describe('publishingDateServerSection', () => {
  // 09:30 BST on 14 September 2027.
  const now = new Date('2027-09-14T08:30:00.000Z');

  function submit(
    body: object,
    instant: string | null = '2027-10-12T09:30:00+01:00',
    at: Date = now,
  ) {
    const ukInstant = vi.fn().mockResolvedValue(instant);
    const { indicators } = createFakeInternalRepositories({ indicators: { ukInstant } });
    const section = publishingDateServerSection(indicators, () => at);

    return { section, submission: section.schema.safeParseAsync(body), ukInstant };
  }

  async function fieldErrorsOf({ section, submission }: ReturnType<typeof submit>) {
    const result = await submission;
    return result.success ? undefined : toFieldErrors(result.error, section.fields.options);
  }

  it('adds the instant the UK date and time name, 28 days ahead', async () => {
    const { submission, ukInstant } = submit({
      ...publishingDate,
      publishingDateDay: '12',
      publishingDateMonth: '10',
    });
    const result = await submission;

    expect(ukInstant).toHaveBeenCalledWith({ year: 2027, month: 10, day: 12, hour: 9, minute: 30 });
    expect(result.success && result.data.scheduledPublishAt).toBe('2027-10-12T09:30:00+01:00');
  });

  function dated(day: string, month: string, year = '2027') {
    return {
      ...publishingDate,
      publishingDateDay: day,
      publishingDateMonth: month,
      publishingDateYear: year,
    };
  }

  it.each([
    ['27 days from today', dated('11', '10')],
    ['today', dated('14', '9')],
    ['in the past', dated('13', '9')],
  ])('refuses a date %s, on the parts of the date', async (_, body) => {
    const submitted = submit(body);
    const message = 'Publishing date must be at least 28 days from today';

    expect(await fieldErrorsOf(submitted)).toEqual({
      publishingDateDay: message,
      publishingDateMonth: message,
      publishingDateYear: message,
    });
    expect(submitted.ukInstant).not.toHaveBeenCalled();
  });

  it('accepts any time on the date 28 days from today', async () => {
    // Less than 28 × 24 hours after 09:30 on 14 September.
    const midnight = { ...dated('12', '10'), publishingTimeHour: '00', publishingTimeMinute: '00' };

    expect((await submit(midnight, '2027-10-12T00:00:00+01:00').submission).success).toBe(true);
  });

  it("counts from today's date in the UK", async () => {
    // 00:30 BST on 15 September, still 14 September in UTC.
    const lateEvening = new Date('2027-09-14T23:30:00.000Z');

    expect(await fieldErrorsOf(submit(dated('12', '10'), undefined, lateEvening))).toBeDefined();
    expect((await submit(dated('13', '10'), undefined, lateEvening).submission).success).toBe(true);
  });

  it('counts calendar days across a clock change', async () => {
    // 09:30 GMT on 5 March; 09:30 BST on 2 April is an hour short of 28 × 24 hours later.
    const march = new Date('2027-03-05T09:30:00.000Z');
    const submitted = submit(dated('2', '4'), '2027-04-02T09:30:00+01:00', march);

    expect((await submitted.submission).success).toBe(true);
  });

  it('refuses a time the spring clock change skips, on the parts of the time', async () => {
    const skipped = {
      publishingDateDay: '26',
      publishingDateMonth: '3',
      publishingDateYear: '2028',
      publishingTimeHour: '01',
      publishingTimeMinute: '30',
    };

    expect(await fieldErrorsOf(submit(skipped, null))).toEqual({
      publishingTimeHour: 'Publishing time must be a real time',
      publishingTimeMinute: 'Publishing time must be a real time',
    });
  });

  it('refuses a date that is not real without converting it', async () => {
    const { submission, ukInstant } = submit({
      ...publishingDate,
      publishingDateDay: '31',
      publishingDateMonth: '2',
    });

    expect((await submission).success).toBe(false);
    expect(ukInstant).not.toHaveBeenCalled();
  });
});

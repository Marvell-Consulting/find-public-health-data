import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { CiMethodRow } from './ci-method-repository.ts';
import { indicatorTaskKeySchema, toFieldErrors } from './contract.ts';
import type { IndicatorSectionDraft } from './indicator-section.ts';
import {
  calculationColumns,
  confidenceIntervalsColumns,
  definitionAndRationaleColumns,
  indicatorSectionsRouter,
  judgedConfidenceIntervalsSection,
  polarityColumns,
  updateFrequencyColumns,
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

// Every follow-up filled in, as a form without JavaScript may send them.
const everyAnswer = {
  ciMethodModified: 'yes',
  ciMethodModifications: 'Adjusted for clustering',
  ciMethodOtherDetail: 'Bootstrap intervals',
} as const;

describe('indicatorSectionsRouter', () => {
  const sectionKeys = indicatorTaskKeySchema.options.filter((key) => key !== 'name');

  it.each(sectionKeys)(
    'serves the %s section, answering every unanswered field as null',
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
      expect(Object.values(response.body).every((answer) => answer === null)).toBe(true);
    },
  );
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

describe('judgedConfidenceIntervalsSection', () => {
  function judge(
    body: object,
    findById = vi.fn(async (id: string) =>
      Object.values(METHODS).find((method) => method.id === id),
    ),
  ) {
    const { ciMethods } = createFakeInternalRepositories({ ciMethods: { findById } });
    const section = judgedConfidenceIntervalsSection(ciMethods);

    return { findById, submission: section.schema.safeParseAsync(body), section };
  }

  async function fieldErrorsOf(body: object) {
    const { section, submission } = judge(body);
    const result = await submission;
    return result.success ? undefined : toFieldErrors(result.error, section.fields.options);
  }

  it('adds the kind of the chosen method', async () => {
    const result = await judge({ ...everyAnswer, ciMethodId: METHODS.other.id }).submission;

    expect(result.success && result.data.kind).toBe('other');
  });

  it('refuses a method that does not exist', async () => {
    expect(
      await fieldErrorsOf({ ...everyAnswer, ciMethodId: '00000000-0000-7000-8000-000000000999' }),
    ).toEqual({ ciMethodId: 'Select the confidence interval method used' });
  });

  it('refuses an unchosen method without looking for it', async () => {
    const { findById, submission } = judge({ ...everyAnswer, ciMethodId: '' });

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

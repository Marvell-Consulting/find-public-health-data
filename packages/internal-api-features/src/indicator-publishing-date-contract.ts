import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

const fields = z.enum([
  'publishingDateDay',
  'publishingDateMonth',
  'publishingDateYear',
  'publishingTimeHour',
  'publishingTimeMinute',
]);

export type PublishingDateField = z.infer<typeof fields>;

/** The time the form offers until the publisher answers: 09:30 UK time. */
export const DEFAULT_PUBLISHING_TIME = {
  publishingTimeHour: '09',
  publishingTimeMinute: '30',
} as const;

type Answers = Record<PublishingDateField, string>;
type Problems = Partial<Answers>;

const DATE_PARTS = [
  ['publishingDateDay', 'day'],
  ['publishingDateMonth', 'month'],
  ['publishingDateYear', 'year'],
] as const;

const TIME_PARTS = [
  ['publishingTimeHour', 'an hour'],
  ['publishingTimeMinute', 'a minute'],
] as const;

const REAL_DATE = 'Publishing date must be a real date';
// Also given by the API for a time the spring clock change skips.
export const REAL_PUBLISHING_TIME = 'Publishing time must be a real time';

const listWithAnd = new Intl.ListFormat('en-GB', { type: 'conjunction' });

function each(parts: readonly PublishingDateField[], message: string): Problems {
  return Object.fromEntries(parts.map((part) => [part, message]));
}

function unless(ok: boolean, field: PublishingDateField, message: string): Problems {
  return ok ? {} : { [field]: message };
}

/** Up to two digits, from min to max. */
function isSmallNumber(text: string, min: number, max: number): boolean {
  return /^\d{1,2}$/.test(text) && Number(text) >= min && Number(text) <= max;
}

function isDayOfMonth(day: number, month: number, year: number): boolean {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
}

/** What is wrong with the date, on each part the publisher should correct. */
function dateProblems(answers: Answers): Problems {
  const missing = DATE_PARTS.filter(([field]) => answers[field] === '');

  if (missing.length === DATE_PARTS.length) {
    return each(
      DATE_PARTS.map(([field]) => field),
      'Enter the publishing date',
    );
  }

  if (missing.length > 0) {
    const parts = listWithAnd.format(missing.map(([, part]) => part));
    return each(
      missing.map(([field]) => field),
      `Publishing date must include a ${parts}`,
    );
  }

  const { publishingDateDay: day, publishingDateMonth: month, publishingDateYear: year } = answers;
  const problems = {
    ...unless(isSmallNumber(day, 1, 31), 'publishingDateDay', REAL_DATE),
    ...unless(isSmallNumber(month, 1, 12), 'publishingDateMonth', REAL_DATE),
    ...unless(/^\d{4}$/.test(year), 'publishingDateYear', 'Year must include 4 numbers'),
  };

  if (Object.keys(problems).length > 0) return problems;

  // There was no year 0, and the database refuses to name one.
  if (Number(year) === 0) return { publishingDateYear: REAL_DATE };

  return unless(
    isDayOfMonth(Number(day), Number(month), Number(year)),
    'publishingDateDay',
    REAL_DATE,
  );
}

/** What is wrong with the time, on each part the publisher should correct. */
function timeProblems(answers: Answers): Problems {
  const missing = TIME_PARTS.filter(([field]) => answers[field] === '');

  if (missing.length === TIME_PARTS.length) {
    return each(
      TIME_PARTS.map(([field]) => field),
      'Enter the publishing time',
    );
  }

  if (missing.length > 0) {
    return Object.fromEntries(
      missing.map(([field, part]) => [field, `Publishing time must include ${part}`]),
    );
  }

  return {
    ...unless(
      isSmallNumber(answers.publishingTimeHour, 0, 23),
      'publishingTimeHour',
      REAL_PUBLISHING_TIME,
    ),
    ...unless(
      isSmallNumber(answers.publishingTimeMinute, 0, 59),
      'publishingTimeMinute',
      REAL_PUBLISHING_TIME,
    ),
  };
}

/**
 * A real date and a real 24-hour time, in UK local time. A message about the whole date or
 * time is given on each of its parts, so the page marks every part to correct.
 */
const schema = z
  .object({
    publishingDateDay: z.string().trim(),
    publishingDateMonth: z.string().trim(),
    publishingDateYear: z.string().trim(),
    publishingTimeHour: z.string().trim(),
    publishingTimeMinute: z.string().trim(),
  })
  .superRefine((answers, ctx) => {
    const problems = { ...dateProblems(answers), ...timeProblems(answers) };

    for (const [field, message] of Object.entries(problems)) {
      ctx.addIssue({ code: 'custom', path: [field], message });
    }
  });

export type PublishingDate = z.infer<typeof schema>;

export const publishingDateSection: IndicatorSection<PublishingDateField, PublishingDate> = {
  key: 'publishing-date',
  fields,
  schema,
};

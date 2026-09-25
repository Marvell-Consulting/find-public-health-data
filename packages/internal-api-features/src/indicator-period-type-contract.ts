import { z } from '@fphd/config/zod';
import { isDayOfMonth, PERIOD_TYPES, YEAR_TYPES } from '@fphd/utils/period-type';

import type { IndicatorSection } from './indicator-section-contract.ts';

const fields = z.enum(['periodType', 'yearType', 'yearEndDay', 'yearEndMonth']);

export type PeriodTypeField = z.infer<typeof fields>;

const yearTypeIds: readonly string[] = Object.values(YEAR_TYPES).map(({ id }) => id);

const REAL_DATE = 'Date must be a real date';

/** Up to two digits, from 1 to max. */
function isSmallNumber(text: string, max: number): boolean {
  return /^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= max;
}

/** What is wrong with the date the year ends on, on each part the publisher should correct. */
function yearEndProblems(day: string, month: string): Partial<Record<PeriodTypeField, string>> {
  if (day === '' && month === '') {
    return { yearEndDay: 'Enter the date', yearEndMonth: 'Enter the date' };
  }
  if (day === '') return { yearEndDay: 'Date must include a day' };
  if (month === '') return { yearEndMonth: 'Date must include a month' };

  const problems = {
    ...(isSmallNumber(day, 31) ? {} : { yearEndDay: REAL_DATE }),
    ...(isSmallNumber(month, 12) ? {} : { yearEndMonth: REAL_DATE }),
  };

  if (Object.keys(problems).length > 0) return problems;

  return isDayOfMonth(Number(day), Number(month)) ? {} : { yearEndDay: REAL_DATE };
}

/**
 * Years and quarters ask which year they belong to, and a year ending on a specified date asks
 * for the day and month it ends, which may be any day of that month in some year, 29 February
 * included. Months ask nothing more. Answers a choice does not ask for are dropped when saved.
 */
const schema = z
  .object({
    periodType: z.enum(
      [PERIOD_TYPES.years.id, PERIOD_TYPES.quarters.id, PERIOD_TYPES.months.id],
      'Select the period type',
    ),
    yearType: z.string(),
    yearEndDay: z.string().trim(),
    yearEndMonth: z.string().trim(),
  })
  .superRefine(({ periodType, yearType, yearEndDay, yearEndMonth }, ctx) => {
    if (periodType === PERIOD_TYPES.months.id) return;

    if (!yearTypeIds.includes(yearType)) {
      ctx.addIssue({ code: 'custom', path: ['yearType'], message: 'Select the year type' });
      return;
    }

    if (yearType !== YEAR_TYPES.specifiedEndDate.id) return;

    for (const [field, message] of Object.entries(yearEndProblems(yearEndDay, yearEndMonth))) {
      ctx.addIssue({ code: 'custom', path: [field], message });
    }
  });

export type PeriodType = z.infer<typeof schema>;

export const periodTypeSection: IndicatorSection<PeriodTypeField, PeriodType> = {
  key: 'period-type',
  fields,
  schema,
};

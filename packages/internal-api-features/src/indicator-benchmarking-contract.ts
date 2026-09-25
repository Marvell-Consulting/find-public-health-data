import { z } from '@fphd/config/zod';
import { GOAL_POLARITIES } from '@fphd/utils/polarity';

import { type IndicatorSection, yesNoSchema } from './indicator-section-contract.ts';

const fields = z.enum([
  'hasGoalBenchmark',
  'goalLowerValue',
  'goalUpperValue',
  'goalPolarity',
  'goalPolicyDetail',
]);

// Commas only as thousands separators, so "9,5" is never read as 95 nor "0,500" as 500.
const GOAL_VALUE = /^-?(?:(?:[1-9]\d{0,2}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/;

/** The number a goal value's text gives, or undefined for a blank or anything else. */
export function goalValue(text: string): number | undefined {
  if (!GOAL_VALUE.test(text)) return undefined;
  const value = Number(text.replaceAll(',', ''));
  return Number.isFinite(value) ? value : undefined;
}

const PLAIN_DECIMAL = new Intl.NumberFormat('en-GB', {
  useGrouping: false,
  maximumSignificantDigits: 21,
});

/** A stored goal value as the form shows it, never in exponent form, so it reads back the same. */
export function goalValueText(value: number | null): string | null {
  return value === null ? null : PLAIN_DECIMAL.format(value);
}

const schema = z
  .object({
    hasGoalBenchmark: yesNoSchema(
      'Select whether there are any goal benchmarks for this indicator',
    ),
    goalLowerValue: z.string().trim(),
    goalUpperValue: z.string().trim(),
    goalPolarity: z.enum([...GOAL_POLARITIES, ''], { error: 'Select the polarity of the goal' }),
    goalPolicyDetail: z.string().trim(),
  })
  .superRefine((answers, ctx) => {
    if (answers.hasGoalBenchmark !== 'yes') return;

    const issue = (field: 'goalLowerValue' | 'goalUpperValue' | 'goalPolarity', message: string) =>
      ctx.addIssue({ code: 'custom', path: [field], message });
    const lower = goalValue(answers.goalLowerValue);
    const upper = goalValue(answers.goalUpperValue);

    if (answers.goalLowerValue === '') issue('goalLowerValue', 'Enter the lower goal value');
    else if (lower === undefined) issue('goalLowerValue', 'Lower goal value must be a number');

    if (answers.goalUpperValue !== '' && upper === undefined) {
      issue('goalUpperValue', 'Upper goal value must be a number');
    } else if (lower !== undefined && upper !== undefined && upper <= lower) {
      issue('goalUpperValue', 'Upper goal value must be higher than the lower goal value');
    }

    if (answers.goalPolarity === '') issue('goalPolarity', 'Select the polarity of the goal');
  });

export type BenchmarkingField = z.infer<typeof fields>;
export type Benchmarking = z.infer<typeof schema>;

/** Whether the indicator has a policy goal, and the values and direction that meet it. */
export const benchmarkingSection: IndicatorSection<BenchmarkingField, Benchmarking> = {
  key: 'benchmarking',
  fields,
  schema,
};

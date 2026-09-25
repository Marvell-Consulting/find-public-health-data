import { z } from '@fphd/config/zod';
import {
  AGE_TYPES,
  AGE_UNIT_DAYS,
  AGE_UNITS,
  type AgeUnit,
  isAgeUnit,
  MAX_AGE,
  SEXES,
} from '@fphd/utils/sex-and-ages';

import type { IndicatorSection } from './indicator-section-contract.ts';

export const MAX_AGE_RANGES = 20;

const fields = z.enum([
  'sexes',
  'ageType',
  'ageRanges',
  'specificAge',
  'specificAgeUnit',
  'ageOtherDetail',
]);

export type SexAndAgesField = z.infer<typeof fields>;

/** One age range as the form holds it: each limit and its unit as text. */
export interface AgeRangeFormValues {
  lowerLimit: string;
  lowerLimitUnit: string;
  upperLimit: string;
  upperLimitUnit: string;
}

export type AgeRangePart = keyof AgeRangeFormValues;

/** The answers as the form holds them: the sexes ticked, and every other control as text. */
export interface SexAndAgesFormValues {
  sexes: string[];
  ageType: string;
  ageRanges: AgeRangeFormValues[];
  specificAge: string;
  specificAgeUnit: string;
  ageOtherDetail: string;
}

/** A field of one range, named as its control is and as its refusal is keyed. */
export type AgeRangeField = `ageRanges[${number}].${AgeRangePart}`;

export function ageRangeFieldName(index: number, part: AgeRangePart): AgeRangeField {
  return `ageRanges[${index}].${part}`;
}

/** A unit the form does not offer is read as none chosen, so it is asked for again. */
const unit = z.string().transform((value): AgeUnit | '' => (isAgeUnit(value) ? value : ''));

const ageRange = z.object({
  lowerLimit: z.string().trim(),
  lowerLimitUnit: unit,
  upperLimit: z.string().trim(),
  upperLimitUnit: unit,
});

type AgeRange = z.infer<typeof ageRange>;

const SELECT_SEXES = 'Select sexes included';

const WHOLE_NUMBER = /^\d+$/;

function isAge(value: string): boolean {
  return WHOLE_NUMBER.test(value) && Number(value) <= MAX_AGE;
}

/** The messages for each way an age and its unit can be refused. */
interface AgeMessages {
  enter: string;
  wholeNumber: string;
  select: string;
}

/** Why an age and its unit are refused, keyed by the field at fault. */
function ageProblems<ValueField extends string, UnitField extends string>(
  [valueField, unitField]: readonly [ValueField, UnitField],
  value: string,
  unit: AgeUnit | '',
  { enter, wholeNumber, select }: AgeMessages,
): Partial<Record<ValueField | UnitField, string>> {
  const problems: Partial<Record<ValueField | UnitField, string>> = {};

  if (value === '') problems[valueField] = enter;
  else if (!isAge(value)) problems[valueField] = wholeNumber;
  if (unit === '') problems[unitField] = select;

  return problems;
}

export type AgeLimitBound = 'lower' | 'upper';

/** The two fields of each limit of a range: its value and its unit. */
export const AGE_LIMIT_FIELDS = {
  lower: ['lowerLimit', 'lowerLimitUnit'],
  upper: ['upperLimit', 'upperLimitUnit'],
} as const satisfies Record<AgeLimitBound, readonly [AgeRangePart, AgeRangePart]>;

/** A limit's label: "Lower limit" in the first range, and numbered from the second. */
export function ageLimitLabel(bound: AgeLimitBound, index: number): string {
  const label = bound === 'lower' ? 'Lower limit' : 'Upper limit';
  return index === 0 ? label : `${label} ${index + 1}`;
}

function limitName(bound: AgeLimitBound, index: number): string {
  return index === 0 ? `the ${bound} limit` : `${bound} limit ${index + 1}`;
}

/** Why one limit of a range is refused; one left wholly empty is fine beside the other. */
function limitProblems(
  range: AgeRange,
  bound: AgeLimitBound,
  index: number,
): Partial<Record<AgeRangePart, string>> {
  const [valueField, unitField] = AGE_LIMIT_FIELDS[bound];
  const value = range[valueField];
  const unit = range[unitField];

  if (value === '' && unit === '') return {};

  return ageProblems(AGE_LIMIT_FIELDS[bound], value, unit, {
    enter: `Enter ${limitName(bound, index)}`,
    wholeNumber: `${ageLimitLabel(bound, index)} must be a whole number from 0 to ${MAX_AGE}`,
    select: `Select the periods for ${limitName(bound, index)}`,
  });
}

function inDays(value: string, unit: AgeUnit): number {
  return Number(value) * AGE_UNIT_DAYS[unit];
}

/** Why one range is refused, keyed by the part at fault. */
function ageRangeProblems(range: AgeRange, index: number): Partial<Record<AgeRangePart, string>> {
  const { lowerLimit, lowerLimitUnit, upperLimit, upperLimitUnit } = range;

  if (lowerLimit === '' && lowerLimitUnit === '' && upperLimit === '' && upperLimitUnit === '') {
    return {
      lowerLimit:
        index === 0
          ? 'You must enter at least a lower or upper limit'
          : `You must enter at least a lower or upper limit for range ${index + 1}`,
    };
  }

  const problems = {
    ...limitProblems(range, 'lower', index),
    ...limitProblems(range, 'upper', index),
  };

  if (
    Object.keys(problems).length === 0 &&
    lowerLimitUnit !== '' &&
    upperLimitUnit !== '' &&
    inDays(upperLimit, upperLimitUnit) < inDays(lowerLimit, lowerLimitUnit)
  ) {
    return {
      upperLimit: `${ageLimitLabel('upper', index)} must not be lower than ${limitName('lower', index)}`,
    };
  }

  return problems;
}

const schema = z
  .object({
    // Kept in the order the page lists them, once each, whatever order they were sent in.
    sexes: z
      .array(z.string(), { error: SELECT_SEXES })
      .transform((sent) => SEXES.filter((sex) => sent.includes(sex)))
      .pipe(z.array(z.enum(SEXES)).min(1, SELECT_SEXES)),
    ageType: z.enum(AGE_TYPES, { error: 'Select the age type' }),
    ageRanges: z
      .array(ageRange)
      .max(MAX_AGE_RANGES, `You cannot add more than ${MAX_AGE_RANGES} ranges`),
    specificAge: z.string().trim(),
    specificAgeUnit: unit,
    ageOtherDetail: z.string().trim(),
  })
  .superRefine(
    ({ ageType, ageRanges, specificAge, specificAgeUnit, ageOtherDetail }, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message });

      if (ageType === 'range') {
        // The page always shows a range, so none sent is refused where the first one goes.
        if (ageRanges.length === 0) {
          issue(['ageRanges', 0, 'lowerLimit'], 'You must enter at least a lower or upper limit');
        }

        for (const [index, range] of ageRanges.entries()) {
          for (const [part, message] of Object.entries(ageRangeProblems(range, index))) {
            issue(['ageRanges', index, part], message);
          }
        }
      }

      if (ageType === 'specific') {
        const problems = ageProblems(
          ['specificAge', 'specificAgeUnit'],
          specificAge,
          specificAgeUnit,
          {
            enter: 'Enter the age',
            wholeNumber: `Age must be a whole number from 0 to ${MAX_AGE}`,
            select: 'Select the periods',
          },
        );

        for (const [field, message] of Object.entries(problems)) issue([field], message);
      }

      if (ageType === 'other' && ageOtherDetail === '') {
        issue(['ageOtherDetail'], 'Enter the ages included');
      }
    },
    // Also beside unanswered sexes or age type, so every refusal shows at once.
    {
      when: ({ issues }) =>
        issues.every(({ path }) => path?.[0] === 'sexes' || path?.[0] === 'ageType'),
    },
  );

export type SexAndAges = z.infer<typeof schema>;

export const sexAndAgesSection: IndicatorSection<
  SexAndAgesField,
  SexAndAges,
  SexAndAgesFormValues
> = {
  key: 'sex-and-ages',
  fields,
  schema,
};

const ageUnit = z.enum(AGE_UNITS);

/** The draft's answers: null or empty until answered, with each age as a number. */
export const sexAndAgesAnswersSchema = z.object({
  sexes: z.array(z.enum(SEXES)),
  ageType: z.enum(AGE_TYPES).nullable(),
  ageRanges: z.array(
    z.object({
      lowerLimit: z.number().nullable(),
      lowerLimitUnit: ageUnit.nullable(),
      upperLimit: z.number().nullable(),
      upperLimitUnit: ageUnit.nullable(),
    }),
  ),
  specificAge: z.number().nullable(),
  specificAgeUnit: ageUnit.nullable(),
  ageOtherDetail: z.string().nullable(),
});

export type SexAndAgesAnswers = z.infer<typeof sexAndAgesAnswersSchema>;

const text = (value: number | string | null): string => (value === null ? '' : String(value));

export function sexAndAgesFormValues(answers: SexAndAgesAnswers): SexAndAgesFormValues {
  return {
    sexes: answers.sexes,
    ageType: text(answers.ageType),
    ageRanges: answers.ageRanges.map((range) => ({
      lowerLimit: text(range.lowerLimit),
      lowerLimitUnit: text(range.lowerLimitUnit),
      upperLimit: text(range.upperLimit),
      upperLimitUnit: text(range.upperLimitUnit),
    })),
    specificAge: text(answers.specificAge),
    specificAgeUnit: text(answers.specificAgeUnit),
    ageOtherDetail: text(answers.ageOtherDetail),
  };
}

export function areSexAndAgesComplete(answers: SexAndAgesAnswers): boolean {
  return schema.safeParse(sexAndAgesFormValues(answers)).success;
}

/** The page's fields: a range's are named by its row, and the list itself refuses as a whole. */
export type SexAndAgesPageField = SexAndAgesField | AgeRangeField;

/** A range's fields in the order the page asks them. */
export const AGE_RANGE_PARTS: readonly AgeRangePart[] = [
  ...AGE_LIMIT_FIELDS.lower,
  ...AGE_LIMIT_FIELDS.upper,
];

function isAgeRangePart(value: unknown): value is AgeRangePart {
  return (AGE_RANGE_PARTS as readonly unknown[]).includes(value);
}

/** A message for each field refused, keyed as the page names it; the first for a field wins. */
export function sexAndAgesFieldErrors(
  error: z.ZodError,
): Partial<Record<SexAndAgesPageField, string>> {
  const fieldErrors: Partial<Record<SexAndAgesPageField, string>> = {};

  for (const { path, message } of error.issues) {
    const [field, index, part] = path;
    const key =
      field === 'ageRanges' && typeof index === 'number' && isAgeRangePart(part)
        ? ageRangeFieldName(index, part)
        : fields.safeParse(field).data;

    if (key !== undefined) fieldErrors[key] ??= message;
  }

  return fieldErrors;
}

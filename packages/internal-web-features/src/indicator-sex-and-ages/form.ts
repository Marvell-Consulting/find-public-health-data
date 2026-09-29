import {
  type AgeRangeFormValues,
  ageRangeFieldName,
  MAX_AGE_RANGES,
  type SexAndAgesFormValues,
  type SexAndAgesPageField,
} from '@fphd/internal-api-features/contract';

import type { FormFailure } from '../indicator-section.ts';
import { type ListIntent, readListIntent } from '../list-form.ts';

/** The page as the action re-renders it: after a refusal, or with a range added or removed. */
export type SexAndAgesPageState = FormFailure<SexAndAgesPageField, SexAndAgesFormValues>;

const BLANK_AGE_RANGE: AgeRangeFormValues = {
  lowerLimit: '',
  lowerLimitUnit: '',
  upperLimit: '',
  upperLimitUnit: '',
};

/** The answers with a blank range if they hold none, as the page always offers one. */
export function withAgeRangeShown(values: SexAndAgesFormValues): SexAndAgesFormValues {
  return values.ageRanges.length > 0 ? values : { ...values, ageRanges: [BLANK_AGE_RANGE] };
}

function readAgeRanges(formData: FormData): AgeRangeFormValues[] {
  const ranges: AgeRangeFormValues[] = [];

  for (let index = 0; formData.has(ageRangeFieldName(index, 'lowerLimit')); index++) {
    const part = (name: keyof AgeRangeFormValues) => {
      const value = formData.get(ageRangeFieldName(index, name));
      return typeof value === 'string' ? value : '';
    };

    ranges.push({
      lowerLimit: part('lowerLimit'),
      lowerLimitUnit: part('lowerLimitUnit'),
      upperLimit: part('upperLimit'),
      upperLimitUnit: part('upperLimitUnit'),
    });
  }

  return ranges;
}

/** The form as sent, and which of its buttons sent it; a field not sent is empty. */
export function readSexAndAgesForm(formData: FormData): {
  values: SexAndAgesFormValues;
  intent: ListIntent;
} {
  const text = (name: 'ageType' | 'specificAge' | 'specificAgeUnit' | 'ageOtherDetail') => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };

  return {
    values: {
      sexes: formData.getAll('sexes').filter((sex) => typeof sex === 'string'),
      ageType: text('ageType'),
      ageRanges: readAgeRanges(formData),
      specificAge: text('specificAge'),
      specificAgeUnit: text('specificAgeUnit'),
      ageOtherDetail: text('ageOtherDetail'),
    },
    intent: readListIntent(formData),
  };
}

/**
 * The page with a blank range after the others, up to as many as a draft may hold. Adding a
 * range answers "Age range", which a form without JavaScript may not have chosen.
 */
export function withAgeRangeAdded(values: SexAndAgesFormValues): SexAndAgesPageState {
  const ageRanges =
    values.ageRanges.length < MAX_AGE_RANGES
      ? [...values.ageRanges, BLANK_AGE_RANGE]
      : values.ageRanges;

  return { values: { ...values, ageType: 'range', ageRanges }, fieldErrors: {} };
}

/** The page without the range at `index`, keeping everything typed elsewhere. */
export function withAgeRangeRemoved(
  values: SexAndAgesFormValues,
  index: number,
): SexAndAgesPageState {
  const ageRanges = values.ageRanges.filter((_, at) => at !== index);

  return { values: withAgeRangeShown({ ...values, ageRanges }), fieldErrors: {} };
}

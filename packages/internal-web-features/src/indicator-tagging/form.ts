import {
  TAG_LIST_DETAILS,
  TAG_LISTS,
  type TaggingField,
  type TaggingFormValues,
  type TagList,
} from '@fphd/internal-api-features/contract';

import type { FormFailure } from '../indicator-section.ts';
import { type ListIntent, readListIntent } from '../list-form.ts';

/** The select that adds a tag to each list, named as the prototype names it. */
export const ADD_TAG_FIELDS = {
  topicIds: 'addTopic',
  indicatorTypeIds: 'addIndicatorType',
  riskFactorIds: 'addRiskFactor',
  frameworkIds: 'addFramework',
} as const satisfies Record<TagList, string>;

export type AddTagField = (typeof ADD_TAG_FIELDS)[TagList];

/** The page's answers, and the tag chosen in each select but not yet added. */
export type TaggingPageValues = TaggingFormValues & Record<AddTagField, string>;

export type TaggingPageField = TaggingField | AddTagField;

/** The page as the action re-renders it: after a refusal, or with a tag added or removed. */
export type TaggingPageState = FormFailure<TaggingPageField, TaggingPageValues>;

/** The question whose "Yes" a list's tags answer, for the lists that have one. */
const LIST_QUESTIONS: Partial<Record<TagList, 'hasRiskFactor' | 'hasFramework'>> = {
  riskFactorIds: 'hasRiskFactor',
  frameworkIds: 'hasFramework',
};

/** The page with nothing chosen in the selects that add a tag. */
export function taggingPageValues(values: TaggingFormValues): TaggingPageValues {
  return { ...values, addTopic: '', addIndicatorType: '', addRiskFactor: '', addFramework: '' };
}

/** The form as sent, and which of its buttons sent it; a field not sent is empty. */
export function readTaggingForm(formData: FormData): {
  values: TaggingPageValues;
  intent: ListIntent<TagList>;
} {
  const text = (name: 'hasRiskFactor' | 'hasFramework' | AddTagField) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  const ids = (list: TagList) =>
    formData.getAll(list).filter((id): id is string => typeof id === 'string');

  return {
    values: {
      topicIds: ids('topicIds'),
      indicatorTypeIds: ids('indicatorTypeIds'),
      hasRiskFactor: text('hasRiskFactor'),
      riskFactorIds: ids('riskFactorIds'),
      hasFramework: text('hasFramework'),
      frameworkIds: ids('frameworkIds'),
      addTopic: text('addTopic'),
      addIndicatorType: text('addIndicatorType'),
      addRiskFactor: text('addRiskFactor'),
      addFramework: text('addFramework'),
    },
    intent: readListIntent(formData, TAG_LISTS),
  };
}

/** The values with the tag chosen for `list` added once, and its select cleared. */
function withChosen(values: TaggingPageValues, list: TagList): TaggingPageValues {
  const field = ADD_TAG_FIELDS[list];
  const chosen = values[field];
  const tags = values[list].includes(chosen) ? values[list] : [...values[list], chosen];

  return { ...values, [list]: tags, [field]: '' };
}

/**
 * The page with the tag chosen for `list` added, or asking for one. Adding a risk factor or
 * a framework answers "Yes", which a form without JavaScript may not have chosen.
 */
export function withTagAdded(values: TaggingPageValues, list: TagList): TaggingPageState {
  const { article, noun } = TAG_LIST_DETAILS[list];
  const field = ADD_TAG_FIELDS[list];
  const question = LIST_QUESTIONS[list];

  if (values[field] === '') {
    return { values, fieldErrors: { [field]: `Select ${article} ${noun}` } };
  }

  const added = withChosen(values, list);

  return {
    values: question === undefined ? added : { ...added, [question]: 'yes' },
    fieldErrors: {},
  };
}

/** The page without the tag at `index` of `list`, keeping everything else as sent. */
export function withTagRemoved(
  values: TaggingPageValues,
  list: TagList,
  index: number,
): TaggingPageState {
  return {
    values: { ...values, [list]: values[list].filter((_, at) => at !== index) },
    fieldErrors: {},
  };
}

/** The values with every tag chosen but not added taken in, except beside a "No". */
export function withChosenTagsAdded(values: TaggingPageValues): TaggingPageValues {
  return TAG_LISTS.reduce((current, list) => {
    const question = LIST_QUESTIONS[list];
    const wanted = question === undefined || current[question] !== 'no';

    return wanted && current[ADD_TAG_FIELDS[list]] !== '' ? withChosen(current, list) : current;
  }, values);
}

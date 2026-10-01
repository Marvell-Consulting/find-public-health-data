import {
  type Links,
  type LinksAnswers,
  type LinksField,
  type ProviderSources,
  type ProviderSourcesAnswers,
  type ProviderSourcesField,
  type SexAndAges,
  type SexAndAgesAnswers,
  type SexAndAgesField,
  TAG_LIST_DETAILS,
  type Tagging,
  type TaggingAnswers,
  type TaggingField,
  type TagList,
} from './contract.ts';
import { type IndicatorSectionColumns, yesNoAnswer } from './indicator-section.ts';
import type { IndicatorDraftClassification } from './indicator-version-lists-repository.ts';

export const numeratorColumns: IndicatorSectionColumns<
  ProviderSourcesField,
  ProviderSources,
  ProviderSourcesAnswers
> = {
  fromDraft: (draft) => ({
    sources: draft.numeratorSources,
    definition: draft.numeratorDefinition,
  }),
  toAttributes: ({ definition }) => ({ numeratorDefinition: definition }),
  toLists: ({ sources }) => ({ numeratorSources: sources }),
};

export const denominatorColumns: IndicatorSectionColumns<
  ProviderSourcesField,
  ProviderSources,
  ProviderSourcesAnswers
> = {
  fromDraft: (draft) => ({
    sources: draft.denominatorSources,
    definition: draft.denominatorDefinition,
  }),
  toAttributes: ({ definition }) => ({ denominatorDefinition: definition }),
  toLists: ({ sources }) => ({ denominatorSources: sources }),
};

export const linksColumns: IndicatorSectionColumns<LinksField, Links, LinksAnswers> = {
  fromDraft: ({ hasLinks, links }) => ({
    hasLinks: yesNoAnswer(hasLinks),
    links: links.map(({ url, text }) => ({ url, text })),
  }),
  toAttributes: ({ hasLinks }) => ({ hasLinks: hasLinks === 'yes' }),
  // Links sent beside "No" are dropped, whatever the form sent.
  toLists: ({ hasLinks, links }) => ({ links: hasLinks === 'yes' ? links : [] }),
};

// A limit or age the form accepted, which is a whole number or nothing.
function age(value: string): number | null {
  return value === '' ? null : Number(value);
}

export const sexAndAgesColumns: IndicatorSectionColumns<
  SexAndAgesField,
  SexAndAges,
  SexAndAgesAnswers
> = {
  fromDraft: (draft) => ({
    sexes: draft.sexes ?? [],
    ageType: draft.ageType,
    ageRanges: draft.ageRanges,
    specificAge: draft.specificAge,
    specificAgeUnit: draft.specificAgeUnit,
    ageDetail: draft.ageDetail,
  }),
  // Answers the chosen age type does not ask for are cleared, whatever the form sent.
  toAttributes: ({ sexes, ageType, specificAge, specificAgeUnit, ageDetail }) => {
    const specific = ageType === 'specific';

    return {
      sexes,
      ageType,
      specificAge: specific ? age(specificAge) : null,
      specificAgeUnit: specific && specificAgeUnit !== '' ? specificAgeUnit : null,
      ageDetail: ageType === 'other' ? ageDetail : null,
    };
  },
  toLists: ({ ageType, ageRanges }) => ({
    ageRanges:
      ageType === 'range'
        ? ageRanges.map(({ lowerLimit, lowerLimitUnit, upperLimit, upperLimitUnit }) => ({
            lowerLimit: age(lowerLimit),
            lowerLimitUnit: lowerLimitUnit === '' ? null : lowerLimitUnit,
            upperLimit: age(upperLimit),
            upperLimitUnit: upperLimitUnit === '' ? null : upperLimitUnit,
          }))
        : [],
  }),
};

function idsIn(
  classifications: readonly IndicatorDraftClassification[],
  dimension: IndicatorDraftClassification['dimension'],
): string[] {
  return classifications.filter((row) => row.dimension === dimension).map(({ id }) => id);
}

export const taggingColumns: IndicatorSectionColumns<TaggingField, Tagging, TaggingAnswers> = {
  fromDraft: ({ topicIds, classifications, hasRiskFactor, hasFramework }) => ({
    topicIds,
    indicatorTypeIds: idsIn(classifications, 'indicator_type'),
    hasRiskFactor: yesNoAnswer(hasRiskFactor),
    riskFactorIds: idsIn(classifications, 'risk_factor'),
    hasFramework: yesNoAnswer(hasFramework),
    frameworkIds: idsIn(classifications, 'framework'),
  }),
  toAttributes: ({ hasRiskFactor, hasFramework }) => ({
    hasRiskFactor: hasRiskFactor === 'yes',
    hasFramework: hasFramework === 'yes',
  }),
  toLists: (answers) => {
    const kept = (list: TagList) => (isTagListAsked(answers, list) ? answers[list] : []);

    return {
      topicIds: answers.topicIds,
      classificationIds: {
        indicator_type: kept('indicatorTypeIds'),
        risk_factor: kept('riskFactorIds'),
        framework: kept('frameworkIds'),
      },
    };
  },
};

/** Whether the list is asked: always, or beside a yes. Tags beside a "No" are dropped. */
export function isTagListAsked(answers: Tagging, list: TagList): boolean {
  const { question } = TAG_LIST_DETAILS[list];
  return question === null || answers[question] === 'yes';
}

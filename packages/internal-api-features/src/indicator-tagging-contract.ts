import { z } from '@fphd/config/zod';

import type { IndicatorSection } from './indicator-section-contract.ts';

/** One tag a publisher may choose: a topic or a classification. */
export const tagOptionSchema = z.object({ id: z.uuid(), name: z.string().min(1) });

/** Every tag the tagging page offers, each list in the order the page shows it. */
export const tagOptionsSchema = z.object({
  topics: z.array(tagOptionSchema),
  indicatorTypes: z.array(tagOptionSchema),
  riskFactors: z.array(tagOptionSchema),
  frameworks: z.array(tagOptionSchema),
});

export type TagOption = z.infer<typeof tagOptionSchema>;
export type TagOptions = z.infer<typeof tagOptionsSchema>;

/** The page's lists of chosen tags, in the order it asks them. */
export const TAG_LISTS = ['topicIds', 'indicatorTypeIds', 'riskFactorIds', 'frameworkIds'] as const;

export type TagList = (typeof TAG_LISTS)[number];

/** Where each list's choices come from, and the words its messages use. */
export const TAG_LIST_DETAILS = {
  topicIds: { options: 'topics', noun: 'topic', article: 'a' },
  indicatorTypeIds: { options: 'indicatorTypes', noun: 'indicator type', article: 'an' },
  riskFactorIds: { options: 'riskFactors', noun: 'risk factor', article: 'a' },
  frameworkIds: { options: 'frameworks', noun: 'framework or programme', article: 'a' },
} as const satisfies Record<
  TagList,
  { options: keyof TagOptions; noun: string; article: 'a' | 'an' }
>;

/** "Select a topic from the list", for a tag the page no longer offers. */
export function unknownTagMessage(list: TagList): string {
  const { article, noun } = TAG_LIST_DETAILS[list];
  return `Select ${article} ${noun} from the list`;
}

const fields = z.enum([
  'topicIds',
  'indicatorTypeIds',
  'hasRiskFactor',
  'riskFactorIds',
  'hasFramework',
  'frameworkIds',
]);

export type TaggingField = z.infer<typeof fields>;

/** The answers as the form holds them: each list's ids, and each question's choice as text. */
export interface TaggingFormValues {
  topicIds: string[];
  indicatorTypeIds: string[];
  hasRiskFactor: string;
  riskFactorIds: string[];
  hasFramework: string;
  frameworkIds: string[];
}

/** A list's ids, each once in the order added; at least one where `required` says so. */
function tagIds(list: TagList, required?: string) {
  const each = z.array(z.uuid(unknownTagMessage(list)));

  return z
    .array(z.string())
    .transform((sent) => [...new Set(sent)])
    .pipe(required === undefined ? each : each.min(1, required));
}

const yesNo = (error: string) => z.enum(['yes', 'no'], { error });

const schema = z
  .object({
    topicIds: tagIds('topicIds', 'Select at least one topic'),
    indicatorTypeIds: tagIds('indicatorTypeIds', 'Select at least one indicator type'),
    hasRiskFactor: yesNo('Select whether this indicator includes a risk factor'),
    riskFactorIds: tagIds('riskFactorIds'),
    hasFramework: yesNo('Select whether this indicator is part of a framework or programme'),
    frameworkIds: tagIds('frameworkIds'),
  })
  .superRefine(
    ({ hasRiskFactor, riskFactorIds, hasFramework, frameworkIds }, ctx) => {
      if (hasRiskFactor === 'yes' && riskFactorIds.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['riskFactorIds'],
          message: 'Select at least one risk factor',
        });
      }

      if (hasFramework === 'yes' && frameworkIds.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['frameworkIds'],
          message: 'Select at least one framework or programme',
        });
      }
    },
    // Also beside unanswered questions and empty lists, so every refusal shows at once.
    {
      when: ({ issues }) =>
        issues.every(({ path }) => path?.[0] !== 'riskFactorIds' && path?.[0] !== 'frameworkIds'),
    },
  )
  // A "No" drops the tags beside it, whatever the form sent.
  .transform((answers) => ({
    ...answers,
    riskFactorIds: answers.hasRiskFactor === 'yes' ? answers.riskFactorIds : [],
    frameworkIds: answers.hasFramework === 'yes' ? answers.frameworkIds : [],
  }));

export type Tagging = z.infer<typeof schema>;

export const taggingSection: IndicatorSection<TaggingField, Tagging, TaggingFormValues> = {
  key: 'tagging',
  fields,
  schema,
};

/** The draft's answers: null until a question is answered, and no tags until some are chosen. */
export const taggingAnswersSchema = z.object({
  topicIds: z.array(z.string()),
  indicatorTypeIds: z.array(z.string()),
  hasRiskFactor: z.enum(['yes', 'no']).nullable(),
  riskFactorIds: z.array(z.string()),
  hasFramework: z.enum(['yes', 'no']).nullable(),
  frameworkIds: z.array(z.string()),
});

export type TaggingAnswers = z.infer<typeof taggingAnswersSchema>;

export function taggingFormValues(answers: TaggingAnswers): TaggingFormValues {
  return {
    ...answers,
    hasRiskFactor: answers.hasRiskFactor ?? '',
    hasFramework: answers.hasFramework ?? '',
  };
}

export function isTaggingComplete(answers: TaggingAnswers): boolean {
  return schema.safeParse(taggingFormValues(answers)).success;
}

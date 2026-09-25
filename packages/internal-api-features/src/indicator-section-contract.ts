import { z } from '@fphd/config/zod';

import type { IndicatorTaskKey } from './contract.ts';

/** A section's field names, in the order its page asks them. */
export type IndicatorSectionFields<Field extends string> = z.ZodEnum<{ [K in Field]: K }>;

/**
 * One section of a draft, as its page and its endpoint both see it. The key names the task,
 * the page (`/publish/indicators/:id/<key>`) and the endpoint
 * (`/api/internal/indicators/:id/<key>`). The schema takes the answers as the form holds
 * them, which is its text unless the section says otherwise, and is applied at the form and
 * again at the API.
 */
export interface IndicatorSection<Field extends string, Values, Input = Record<Field, string>> {
  key: IndicatorTaskKey;
  fields: IndicatorSectionFields<Field>;
  schema: z.ZodType<Values, Input>;
}

/** A section's answers as the draft holds them: null until a field is answered. */
export function indicatorSectionAnswersSchema<Field extends string>(
  fields: IndicatorSectionFields<Field>,
): z.ZodType<Record<Field, string | null>> {
  return z.record(fields, z.string().nullable());
}

/** Stored answers as the form's text, where an unanswered field is empty. */
export function indicatorSectionFormValues<Field extends string>(
  fields: IndicatorSectionFields<Field>,
  answers: Record<Field, string | null>,
): Record<Field, string> {
  return Object.fromEntries(fields.options.map((field) => [field, answers[field] ?? ''])) as Record<
    Field,
    string
  >;
}

/** Complete once the stored answers are ones the section's form would accept. */
export function isIndicatorSectionComplete<Field extends string, Values>(
  section: IndicatorSection<Field, Values>,
  answers: Record<Field, string | null>,
): boolean {
  return section.schema.safeParse(indicatorSectionFormValues(section.fields, answers)).success;
}

/**
 * The 400 answers. A refused answer is always named; only a bad id names no field. A missing
 * indicator or draft is a 404, which the client throws.
 */
export function indicatorSectionErrorSchema<Field extends string>(
  fields: IndicatorSectionFields<Field>,
): z.ZodType<IndicatorSectionError<Field>> {
  return z.discriminatedUnion('error', [
    z.object({ error: z.literal('invalid_id') }),
    z.object({
      error: z.literal('validation_failed'),
      fieldErrors: z.partialRecord(fields, z.string()),
    }),
  ]);
}

export type IndicatorSectionError<Field extends string> =
  | { error: 'invalid_id' }
  | { error: 'validation_failed'; fieldErrors: Partial<Record<Field, string>> };

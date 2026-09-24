import { z } from '@fphd/config/zod';

import type { IndicatorTaskKey } from './contract.ts';

/** A section's field names, in the order its page asks them. */
export type IndicatorSectionFields<Field extends string> = z.ZodEnum<{ [K in Field]: K }>;

/**
 * One section of a draft, as its page and its endpoint both see it. The key names the task,
 * the page (`/publish/indicators/:id/<key>`) and the endpoint
 * (`/api/internal/indicators/:id/<key>`). Every field travels as the form's text, so the
 * schema takes what was typed and is applied at the form and again at the API.
 */
export interface IndicatorSection<Field extends string, Values> {
  key: IndicatorTaskKey;
  fields: IndicatorSectionFields<Field>;
  schema: z.ZodType<Values, Record<Field, string>>;
}

/** A section's answers as the draft holds them: null until a field is answered. */
export function indicatorSectionAnswersSchema<Field extends string>(
  fields: IndicatorSectionFields<Field>,
): z.ZodType<Record<Field, string | null>> {
  return z.record(fields, z.string().nullable());
}

/** The 400 answers; a missing indicator or draft is a 404, which the client throws. */
export function indicatorSectionErrorSchema<Field extends string>(
  fields: IndicatorSectionFields<Field>,
): z.ZodType<IndicatorSectionError<Field>> {
  return z.object({
    error: z.enum(['invalid_id', 'validation_failed']),
    fieldErrors: z.partialRecord(fields, z.string()).optional(),
  });
}

export interface IndicatorSectionError<Field extends string> {
  error: 'invalid_id' | 'validation_failed';
  fieldErrors?: Partial<Record<Field, string>> | undefined;
}

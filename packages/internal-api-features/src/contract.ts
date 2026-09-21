import { SLUG_PATTERN } from '@fphd/config/slug';
import { z } from '@fphd/config/zod';

/**
 * The wire contract for the internal API, shared by its routers and the internal web app's
 * loaders. Like the public contract it imports only zod and the slug rule, on its own subpath,
 * so the web app takes no Express or database dependency. Ids appear here and nowhere in the
 * public contract: a write needs a stable address, and the slug is editable.
 */
export const topicIdSchema = z.uuid();

export const topicAdminSummarySchema = z.object({
  id: topicIdSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const topicAdminSummaryListSchema = z.array(topicAdminSummarySchema);

export const topicAdminDetailSchema = topicAdminSummarySchema.extend({
  description: z.string(),
});

/**
 * The import rules (`topicRecordSchema`) plus the messages a form shows. Values are trimmed
 * before they are measured. Uniqueness is left to the database, which reports it as a field error.
 */
export const topicUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Enter a topic name'),
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a slug')
    .regex(SLUG_PATTERN, 'Slug must be lowercase letters or numbers, separated by hyphens'),
  description: z.string().trim().min(1, 'Enter a description'),
});

export const topicFieldSchema = z.enum(['title', 'slug', 'description']);

export const topicFieldErrorsSchema = z.partialRecord(topicFieldSchema, z.string());

/** One message per field: a control shows one error even when a value breaks two rules. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === 'string' && !Object.hasOwn(fieldErrors, field)) {
      Object.assign(fieldErrors, { [field]: issue.message });
    }
  }

  return fieldErrors;
}

export const topicCreateResponseSchema = z.object({
  topic: topicAdminDetailSchema,
});

export const topicUpdateResponseSchema = z.object({
  /** False when the submission matched the stored topic, so nothing was written. */
  changed: z.boolean(),
  topic: topicAdminDetailSchema,
});

export const topicUpdateErrorSchema = z.object({
  error: z.enum(['invalid_id', 'validation_failed', 'slug_taken']),
  fieldErrors: topicFieldErrorsSchema.optional(),
});

export type TopicAdminSummary = z.infer<typeof topicAdminSummarySchema>;
export type TopicAdminDetail = z.infer<typeof topicAdminDetailSchema>;
export type TopicField = z.infer<typeof topicFieldSchema>;
export type TopicFieldErrors = z.infer<typeof topicFieldErrorsSchema>;
export type TopicUpdate = z.infer<typeof topicUpdateSchema>;
export type TopicCreateResponse = z.infer<typeof topicCreateResponseSchema>;
export type TopicUpdateResponse = z.infer<typeof topicUpdateResponseSchema>;
export type TopicUpdateError = z.infer<typeof topicUpdateErrorSchema>;

export const indicatorAdminSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  updatedAt: z.iso.datetime(),
});

/** Parsed from a query string, so the page arrives as text; absent means the first page. */
export const indicatorPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const indicatorAdminPageSchema = z.object({
  indicators: z.array(indicatorAdminSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export const indicatorIdSchema = z.uuid();

/** Derived from the indicator's versions: draft while one exists, published otherwise. */
export const indicatorStatusSchema = z.enum(['draft', 'published']);

export const indicatorAdminDetailSchema = z.object({
  id: indicatorIdSchema,
  /** The public indicator number, which is what a publisher knows an indicator by. */
  shortId: z.number().int(),
  name: z.string().min(1),
  /** The published version's slug: the indicator's public address, absent until it has one. */
  publishedSlug: z.string().min(1).nullable(),
  status: indicatorStatusSchema,
  updatedAt: z.iso.datetime(),
});

const DIGITS_ONLY = /^\d+$/;

// Words are whitespace-separated, so a hyphenated term counts as one.
const hasSeveralWords = (name: string) => name.split(/\s+/).length > 1;

/**
 * The one answer the name page asks for, whether it starts an indicator or renames a draft.
 * A name of digits alone would read as a short id wherever a slug is accepted, so it is refused.
 */
export const indicatorNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the name of the indicator')
    .refine((name) => !DIGITS_ONLY.test(name), 'Enter a name that is not only numbers')
    .refine(hasSeveralWords, 'Enter a name with more than one word'),
});

export const indicatorFieldSchema = z.enum(['name']);

export const indicatorFieldErrorsSchema = z.partialRecord(indicatorFieldSchema, z.string());

/** A created or renamed indicator reads the same as one fetched by id. */
export const indicatorCreateResponseSchema = indicatorAdminDetailSchema;

export const indicatorCreateErrorSchema = z.object({
  error: z.enum(['validation_failed']),
  fieldErrors: indicatorFieldErrorsSchema.optional(),
});

/** Renaming addresses an existing indicator, which may be gone or have nothing to edit. */
export const indicatorUpdateErrorSchema = z.object({
  error: z.enum(['invalid_id', 'validation_failed', 'not_found', 'no_draft']),
  fieldErrors: indicatorFieldErrorsSchema.optional(),
});

export type IndicatorAdminSummary = z.infer<typeof indicatorAdminSummarySchema>;
export type IndicatorAdminPage = z.infer<typeof indicatorAdminPageSchema>;
export type IndicatorStatus = z.infer<typeof indicatorStatusSchema>;
export type IndicatorAdminDetail = z.infer<typeof indicatorAdminDetailSchema>;
export type IndicatorName = z.infer<typeof indicatorNameSchema>;
export type IndicatorField = z.infer<typeof indicatorFieldSchema>;
export type IndicatorFieldErrors = z.infer<typeof indicatorFieldErrorsSchema>;
export type IndicatorCreateResponse = z.infer<typeof indicatorCreateResponseSchema>;
export type IndicatorCreateError = z.infer<typeof indicatorCreateErrorSchema>;
export type IndicatorUpdateError = z.infer<typeof indicatorUpdateErrorSchema>;

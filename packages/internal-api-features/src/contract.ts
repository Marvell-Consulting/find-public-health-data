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
export function toFieldErrors(error: z.ZodError): TopicFieldErrors {
  const fieldErrors: TopicFieldErrors = {};

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

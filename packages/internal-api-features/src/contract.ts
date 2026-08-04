import { z } from '@fphd/config/zod';

/**
 * The wire contract for the internal API, defined once and imported by both sides: the
 * routers build responses to these shapes, and the internal web app's loaders and actions
 * parse against them.
 *
 * Like the public contract this module imports nothing but zod, and is exposed on its own
 * subpath, so the web app can depend on it without pulling Express or the database package
 * into its module graph.
 *
 * Ids appear here and nowhere in the public contract. A write has to address a topic by
 * something stable, and the slug is the thing being edited.
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

export const TOPIC_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The same rules the import path applies (`topicRecordSchema`), plus the messages a form has
 * to show. Values are trimmed before they are measured, so a name of spaces is empty.
 *
 * Uniqueness is absent deliberately — only the database can settle it, and it comes back from
 * the write as a field error rather than being asked for in advance.
 */
export const topicUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Enter a topic name'),
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a slug')
    .regex(TOPIC_SLUG_PATTERN, 'Slug must be lowercase letters or numbers, separated by hyphens'),
  description: z.string().trim().min(1, 'Enter a description'),
});

export const topicFieldSchema = z.enum(['title', 'slug', 'description']);

export const topicFieldErrorsSchema = z.partialRecord(topicFieldSchema, z.string());

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
export type TopicUpdateResponse = z.infer<typeof topicUpdateResponseSchema>;
export type TopicUpdateError = z.infer<typeof topicUpdateErrorSchema>;

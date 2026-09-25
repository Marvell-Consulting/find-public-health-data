import { z } from '@fphd/config/zod';
import { SLUG_PATTERN, type SlugProblem, slugProblem } from '@fphd/utils/slug';

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

/**
 * One message per field: a control shows one error even when a value breaks two rules.
 * `fields` is the contract's own list, so the caller gets those keys and nothing else —
 * an issue on anything the form does not show is dropped rather than sent as a field error.
 */
export function toFieldErrors<Field extends string>(
  error: z.ZodError,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const known = new Set<string>(fields);
  const isField = (value: unknown): value is Field => typeof value === 'string' && known.has(value);
  const fieldErrors: Partial<Record<Field, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (isField(field) && !Object.hasOwn(fieldErrors, field)) {
      fieldErrors[field] = issue.message;
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

/** The 400 and 409 answers. A refused value is always named; only a bad id names no field. */
export const topicUpdateErrorSchema = z.discriminatedUnion('error', [
  z.object({ error: z.literal('invalid_id') }),
  z.object({
    error: z.enum(['validation_failed', 'slug_taken']),
    fieldErrors: topicFieldErrorsSchema,
  }),
]);

export type TopicAdminSummary = z.infer<typeof topicAdminSummarySchema>;
export type TopicAdminDetail = z.infer<typeof topicAdminDetailSchema>;
export type TopicField = z.infer<typeof topicFieldSchema>;
export type TopicFieldErrors = z.infer<typeof topicFieldErrorsSchema>;
export type TopicUpdate = z.infer<typeof topicUpdateSchema>;
export type TopicCreateResponse = z.infer<typeof topicCreateResponseSchema>;
export type TopicUpdateResponse = z.infer<typeof topicUpdateResponseSchema>;
export type TopicUpdateError = z.infer<typeof topicUpdateErrorSchema>;

/** What the public has: live once any version is published, new until then. */
export const indicatorStatusSchema = z.enum(['new', 'live']);

/** The open draft's workflow state. The states after submission arrive with the workflow. */
export const draftStatusSchema = z.enum(['draft']);

/**
 * Both statuses are derived from the versions, never stored, and sent as values rather than
 * labels: what each is called is the web UI's decision.
 */
export const indicatorAdminSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  updatedAt: z.iso.datetime(),
  indicatorStatus: indicatorStatusSchema,
  /** Null while the indicator has no draft, which for a live one means it is published as is. */
  draftStatus: draftStatusSchema.nullable(),
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

export const indicatorAdminDetailSchema = indicatorAdminSummarySchema.extend({
  /** The public indicator number, which is what a publisher knows an indicator by. */
  shortId: z.number().int(),
  /** The published version's slug: the indicator's public address, absent until it has one. */
  publishedSlug: z.string().min(1).nullable(),
});

/** Why the slug rule refuses a name, in the words the publisher reads. */
const SLUG_PROBLEM_MESSAGES: Record<SlugProblem, string> = {
  digits: 'Enter a name that is not only numbers',
  empty: 'Enter a name that includes letters or numbers',
  reserved: 'Enter a different name, this one is reserved for the service',
};

/**
 * The one answer the name page asks for, whether it starts an indicator or renames a draft.
 * The name carries the indicator's public address, so it is held to the slug rule here
 * rather than at the write, where a name that yields no slug is a bug.
 */
export const indicatorNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the name of the indicator')
    .max(300, 'Indicator name must be 300 characters or fewer')
    .superRefine((name, ctx) => {
      const problem = slugProblem(name);

      if (problem !== undefined) {
        ctx.addIssue({ code: 'custom', message: SLUG_PROBLEM_MESSAGES[problem] });
      }
    }),
});

export const indicatorFieldSchema = z.enum(['name']);

export const indicatorFieldErrorsSchema = z.partialRecord(indicatorFieldSchema, z.string());

/** A created or renamed indicator reads the same as one fetched by id. */
export const indicatorCreateResponseSchema = indicatorAdminDetailSchema;

export const indicatorCreateErrorSchema = z.object({
  error: z.enum(['validation_failed', 'slug_taken']),
  fieldErrors: indicatorFieldErrorsSchema,
});

/**
 * The 400 and 409 answers. A refused value is always named; only a bad id names no field. A
 * missing indicator or draft is a 404, which the client throws.
 */
export const indicatorUpdateErrorSchema = z.discriminatedUnion('error', [
  z.object({ error: z.literal('invalid_id') }),
  z.object({
    error: z.enum(['validation_failed', 'slug_taken']),
    fieldErrors: indicatorFieldErrorsSchema,
  }),
]);

export type IndicatorAdminSummary = z.infer<typeof indicatorAdminSummarySchema>;
export type IndicatorAdminPage = z.infer<typeof indicatorAdminPageSchema>;
export type IndicatorStatus = z.infer<typeof indicatorStatusSchema>;
export type DraftStatus = z.infer<typeof draftStatusSchema>;
export type IndicatorAdminDetail = z.infer<typeof indicatorAdminDetailSchema>;
export type IndicatorName = z.infer<typeof indicatorNameSchema>;
export type IndicatorField = z.infer<typeof indicatorFieldSchema>;
export type IndicatorFieldErrors = z.infer<typeof indicatorFieldErrorsSchema>;
export type IndicatorCreateResponse = z.infer<typeof indicatorCreateResponseSchema>;
export type IndicatorCreateError = z.infer<typeof indicatorCreateErrorSchema>;
export type IndicatorUpdateError = z.infer<typeof indicatorUpdateErrorSchema>;

/**
 * Where one task on an indicator's task list stands. The vocabulary grows with the journey:
 * incomplete, cannot_start, updated and unchanged all arrive with the sections that need them.
 */
export const indicatorTaskStatusSchema = z.enum(['not_started', 'completed']);

/** The tasks the API judges. A section joins this list when its form exists. */
export const indicatorTaskKeySchema = z.enum([
  'name',
  'definition-and-rationale',
  'polarity',
  'calculation',
  'confidence-intervals',
  'update-frequency',
  'other-notes-and-caveats',
  'publishing-date',
  'links',
]);

export const indicatorTaskStatusesSchema = z.partialRecord(
  indicatorTaskKeySchema,
  indicatorTaskStatusSchema,
);

/**
 * Everything the task list page shows about a draft in one answer: what the indicator is
 * called and its statuses, as the detail response gives them, whether this edit changes a
 * published indicator, and where each task stands. A task the API does not name has no form
 * yet, so the page shows it as not started.
 */
export const indicatorTaskListSchema = z.object({
  indicator: indicatorAdminDetailSchema.pick({
    id: true,
    shortId: true,
    name: true,
    indicatorStatus: true,
    // Nullable as picked, but never null here: the endpoint answers 404 when there is no draft.
    draftStatus: true,
  }),
  /** True when the indicator is live, so this edit revises what the public has. */
  isUpdate: z.boolean(),
  /** True once every task the state carries is complete. */
  canSubmit: z.boolean(),
  tasks: indicatorTaskStatusesSchema,
});

/** `no_draft` is the PATCH route's word for an indicator with nothing to edit. */
export const indicatorTaskListErrorSchema = z.object({
  error: z.enum(['invalid_id', 'not_found', 'no_draft']),
});

export type IndicatorTaskStatus = z.infer<typeof indicatorTaskStatusSchema>;
export type IndicatorTaskKey = z.infer<typeof indicatorTaskKeySchema>;
export type IndicatorTaskStatuses = z.infer<typeof indicatorTaskStatusesSchema>;
export type IndicatorTaskList = z.infer<typeof indicatorTaskListSchema>;
export type IndicatorTaskListError = z.infer<typeof indicatorTaskListErrorSchema>;

export * from './indicator-calculation-contract.ts';
export * from './indicator-confidence-intervals-contract.ts';
export * from './indicator-definition-and-rationale-contract.ts';
export * from './indicator-links-contract.ts';
export * from './indicator-other-notes-and-caveats-contract.ts';
export * from './indicator-polarity-contract.ts';
export * from './indicator-publishing-date-contract.ts';
export * from './indicator-section-contract.ts';
export * from './indicator-update-frequency-contract.ts';

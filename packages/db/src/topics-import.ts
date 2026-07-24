import { z } from '@fphd/config';

export const topicRecordSchema = z.object({
  id: z.uuid(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, hyphen-separated words'),
  title: z.string().min(1),
  description: z.string().min(1),
});

export type TopicRecord = z.infer<typeof topicRecordSchema>;

const topicsFileSchema = z.array(topicRecordSchema);

/**
 * Parses and validates a topics import file. Beyond per-record shape, rejects duplicate ids
 * or slugs within the file — either would make the upsert's `ON CONFLICT (id)` target
 * ambiguous or silently clobber one topic with another's data.
 */
export function parseTopicsFile(data: unknown): TopicRecord[] {
  const result = topicsFileSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid topics file:\n${z.prettifyError(result.error)}`);
  }

  const topics = result.data;

  const duplicateIds = findDuplicates(topics.map((topic) => topic.id));
  const duplicateSlugs = findDuplicates(topics.map((topic) => topic.slug));

  if (duplicateIds.length > 0 || duplicateSlugs.length > 0) {
    const problems = [
      ...duplicateIds.map((id) => `duplicate id: ${id}`),
      ...duplicateSlugs.map((slug) => `duplicate slug: ${slug}`),
    ];
    throw new Error(`Invalid topics file:\n${problems.join('\n')}`);
  }

  return topics;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}

export interface ExistingTopic {
  id: string;
  slug: string;
  title: string;
  description: string;
}

/** Rows present in the database but absent from the file — reported, never deleted. */
export function findOrphanedTopics(
  fileTopics: TopicRecord[],
  existingTopics: ExistingTopic[],
): ExistingTopic[] {
  const fileIds = new Set(fileTopics.map((topic) => topic.id));

  return existingTopics.filter((topic) => !fileIds.has(topic.id));
}

export interface UpsertOutcome {
  id: string;
  /** True for a fresh insert (`xmax = 0`), false for a row the conflict clause updated. */
  wasInsert: boolean;
}

export interface ImportSummary {
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Rows the database didn't return went through the upsert's conflict branch but failed its
 * `setWhere` — i.e. an existing row whose data already matched the file, left untouched.
 */
export function summarizeUpsert(fileTopicCount: number, outcomes: UpsertOutcome[]): ImportSummary {
  const inserted = outcomes.filter((outcome) => outcome.wasInsert).length;
  const updated = outcomes.filter((outcome) => !outcome.wasInsert).length;

  return { inserted, updated, unchanged: fileTopicCount - inserted - updated };
}

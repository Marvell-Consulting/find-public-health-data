import { z } from '@fphd/config';

import { type TopicRecord, topicRecordSchema } from './schema/index.js';

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

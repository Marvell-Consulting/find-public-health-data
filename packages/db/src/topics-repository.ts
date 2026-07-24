import { sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { topics } from './schema.js';
import {
  type ExistingTopic,
  findOrphanedTopics,
  type ImportSummary,
  summarizeUpsert,
  type TopicRecord,
} from './topics-import.js';

export interface ImportResult {
  summary: ImportSummary;
  orphaned: ExistingTopic[];
}

/**
 * Upserts the file's topics into the database, matched on id. Never deletes: a database row
 * missing from the file is reported back via `orphaned`, not removed.
 */
export async function importTopics(db: Database, fileTopics: TopicRecord[]): Promise<ImportResult> {
  const existingTopics = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      title: topics.title,
      description: topics.description,
    })
    .from(topics);

  const orphaned = findOrphanedTopics(fileTopics, existingTopics);

  const outcomes = fileTopics.length
    ? await db
        .insert(topics)
        .values(fileTopics)
        .onConflictDoUpdate({
          target: topics.id,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            updatedAt: sql`now()`,
          },
          // Only rewrite the row (and bump updatedAt) when the file actually disagrees with
          // what's stored — otherwise a no-op re-run would still touch every row's timestamp.
          setWhere: sql`${topics.slug} IS DISTINCT FROM excluded.slug OR ${topics.title} IS DISTINCT FROM excluded.title OR ${topics.description} IS DISTINCT FROM excluded.description`,
        })
        // xmax = 0 is the standard postgres upsert idiom for "this row was just inserted, not
        // updated" — a fresh tuple has never been superseded, so its xmax is unset.
        .returning({ id: topics.id, wasInsert: sql<boolean>`xmax = 0` })
    : [];

  return { summary: summarizeUpsert(fileTopics.length, outcomes), orphaned };
}

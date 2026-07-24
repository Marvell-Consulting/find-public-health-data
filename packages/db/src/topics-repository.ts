import { sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { type TopicRecord, topics } from './schema/index.js';

export interface ExistingTopic {
  id: string;
  slug: string;
  title: string;
  description: string;
}

/** Rows present in the database but absent from the given records — reported, never deleted. */
export function findOrphanedTopics(
  records: TopicRecord[],
  existingTopics: ExistingTopic[],
): ExistingTopic[] {
  const recordIds = new Set(records.map((record) => record.id));

  return existingTopics.filter((topic) => !recordIds.has(topic.id));
}

export interface UpsertOutcome {
  id: string;
  /** True for a fresh insert (`xmax = 0`), false for a row the conflict clause updated. */
  wasInsert: boolean;
}

export interface UpsertSummary {
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Rows the database didn't return went through the upsert's conflict branch but failed its
 * `setWhere` — i.e. an existing row whose data already matched the incoming record, left
 * untouched.
 */
export function summarizeUpsert(recordCount: number, outcomes: UpsertOutcome[]): UpsertSummary {
  const inserted = outcomes.filter((outcome) => outcome.wasInsert).length;
  const updated = outcomes.filter((outcome) => !outcome.wasInsert).length;

  return { inserted, updated, unchanged: recordCount - inserted - updated };
}

export interface UpsertResult {
  summary: UpsertSummary;
  orphaned: ExistingTopic[];
}

/**
 * Upserts the given topics, matched on id. Never deletes: a database row absent from the
 * records is reported back via `orphaned`, not removed.
 */
export async function upsertTopics(db: Database, records: TopicRecord[]): Promise<UpsertResult> {
  const existingTopics = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      title: topics.title,
      description: topics.description,
    })
    .from(topics);

  const orphaned = findOrphanedTopics(records, existingTopics);

  const outcomes = records.length
    ? await db
        .insert(topics)
        .values(records)
        .onConflictDoUpdate({
          target: topics.id,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            updatedAt: sql`now()`,
          },
          // Only rewrite the row (and bump updatedAt) when the incoming record actually
          // disagrees with what's stored — otherwise a no-op re-run would still touch every
          // row's timestamp.
          setWhere: sql`${topics.slug} IS DISTINCT FROM excluded.slug OR ${topics.title} IS DISTINCT FROM excluded.title OR ${topics.description} IS DISTINCT FROM excluded.description`,
        })
        // xmax = 0 is the standard postgres upsert idiom for "this row was just inserted, not
        // updated" — a fresh tuple has never been superseded, so its xmax is unset.
        .returning({ id: topics.id, wasInsert: sql<boolean>`xmax = 0` })
    : [];

  return { summary: summarizeUpsert(records.length, outcomes), orphaned };
}

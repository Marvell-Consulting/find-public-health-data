import { asc, eq, sql } from 'drizzle-orm';

import { recordAudit } from './audit-log.ts';
import type { Database } from './client.ts';
import { CORE_DATA_IMPORT, upsertEntries, upsertedRow } from './core-data-audit.ts';
import { publishedTopic, SYSTEM_USER_IDS, type TopicRecord, topic } from './schema/index.ts';

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

/** A topic as the public read surface serves it: no writers. */
export type Topic = typeof publishedTopic.$inferSelect;

export interface UpsertResult {
  summary: UpsertSummary;
  orphaned: ExistingTopic[];
}

/** All topics, ordered alphabetically by title. */
export async function listTopics(db: Database): Promise<Topic[]> {
  return db.select().from(publishedTopic).orderBy(asc(publishedTopic.title));
}

/** The topic with the given slug, or `undefined` if no topic matches. */
export async function getTopicBySlug(db: Database, slug: string): Promise<Topic | undefined> {
  const rows = await db.select().from(publishedTopic).where(eq(publishedTopic.slug, slug));
  return rows[0];
}

/**
 * Upserts the given topics, matched on id, as the core data import. Never deletes: a database row
 * absent from the records is reported back via `orphaned`, not removed.
 */
export async function upsertTopics(db: Database, records: TopicRecord[]): Promise<UpsertResult> {
  return db.transaction(async (tx) => {
    const existingTopics = await tx
      .select({
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
      })
      .from(topic);

    const orphaned = findOrphanedTopics(records, existingTopics);

    const outcomes = records.length
      ? await tx
          .insert(topic)
          .values(
            records.map((record) => ({
              ...record,
              createdBy: SYSTEM_USER_IDS.coreDataImport,
              updatedBy: SYSTEM_USER_IDS.coreDataImport,
            })),
          )
          .onConflictDoUpdate({
            target: topic.id,
            set: {
              slug: sql`excluded.slug`,
              title: sql`excluded.title`,
              description: sql`excluded.description`,
              updatedAt: sql`now()`,
              updatedBy: sql`excluded.updated_by`,
            },
            // Only rewrite the row (and bump updatedAt) when the incoming record actually
            // disagrees with what's stored — otherwise a no-op re-run would still touch every
            // row's timestamp.
            setWhere: sql`${topic.slug} IS DISTINCT FROM excluded.slug OR ${topic.title} IS DISTINCT FROM excluded.title OR ${topic.description} IS DISTINCT FROM excluded.description`,
          })
          // xmax = 0 is the standard postgres upsert idiom for "this row was just inserted, not
          // updated" — a fresh tuple has never been superseded, so its xmax is unset.
          .returning({ id: topic.id, wasInsert: sql<boolean>`xmax = 0`, ...upsertedRow })
      : [];
    await recordAudit(tx, CORE_DATA_IMPORT, upsertEntries('topic', outcomes));

    return { summary: summarizeUpsert(records.length, outcomes), orphaned };
  });
}

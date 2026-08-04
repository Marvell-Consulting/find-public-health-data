import { asc, eq, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { type TopicRecord, topic } from './schema/index.js';

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

export type Topic = typeof topic.$inferSelect;

export interface UpsertResult {
  summary: UpsertSummary;
  orphaned: ExistingTopic[];
}

/** All topics, ordered alphabetically by title. */
export async function listTopics(db: Database): Promise<Topic[]> {
  return db.select().from(topic).orderBy(asc(topic.title));
}

/** The topic with the given slug, or `undefined` if no topic matches. */
export async function getTopicBySlug(db: Database, slug: string): Promise<Topic | undefined> {
  const rows = await db.select().from(topic).where(eq(topic.slug, slug));
  return rows[0];
}

/**
 * The topic with the given id, or `undefined` if no topic matches. Writes address a topic by
 * id rather than slug, because the slug is itself editable.
 */
export async function getTopicById(db: Database, id: string): Promise<Topic | undefined> {
  const rows = await db.select().from(topic).where(eq(topic.id, id));
  return rows[0];
}

export type TopicUpdate = Pick<Topic, 'description' | 'slug' | 'title'>;

export type UpdateTopicResult =
  | { ok: true; topic: Topic; changed: boolean }
  | { ok: false; reason: 'not_found' | 'slug_taken' };

const UNIQUE_VIOLATION = '23505';

/**
 * Drizzle wraps a driver error in its own, so the SQLSTATE is on the cause rather than the
 * error it throws — hence the walk rather than a single property read.
 */
function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current !== null && current !== undefined; ) {
    if (typeof current !== 'object') return false;
    if ('code' in current && (current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

function matches(current: Topic, update: TopicUpdate): boolean {
  return (
    current.slug === update.slug &&
    current.title === update.title &&
    current.description === update.description
  );
}

/**
 * Apply an edit to one topic, reporting the outcome as a value rather than an exception —
 * both failures are things a form has to render, not faults.
 *
 * The row lock is what makes the compare safe: without it two concurrent saves both read the
 * old row, and the later write silently overwrites the earlier one having decided, from stale
 * data, that it was a change.
 */
export async function updateTopic(
  db: Database,
  id: string,
  { description, slug, title }: TopicUpdate,
): Promise<UpdateTopicResult> {
  const update = { description, slug, title };

  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select().from(topic).where(eq(topic.id, id)).for('update');

      if (current === undefined) return { ok: false, reason: 'not_found' };
      if (matches(current, update)) return { ok: true, topic: current, changed: false };

      // Named columns, not a spread of the argument: a caller merging an edit into a whole
      // topic row would otherwise have this rewrite the key and the creation timestamp —
      // which the column-scoped grant refuses outright for internal_api.
      const [updated] = await tx
        .update(topic)
        .set({ ...update, updatedAt: sql`now()` })
        .where(eq(topic.id, id))
        .returning();

      if (updated === undefined) {
        // The row was locked a moment ago, so it cannot have gone; a miss here means the
        // update matched on something other than the row we read.
        throw new Error(`updateTopic locked topic ${id} but updated no row`);
      }

      return { ok: true, topic: updated, changed: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}

/**
 * Upserts the given topics, matched on id. Never deletes: a database row absent from the
 * records is reported back via `orphaned`, not removed.
 */
export async function upsertTopics(db: Database, records: TopicRecord[]): Promise<UpsertResult> {
  const existingTopics = await db
    .select({
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
    })
    .from(topic);

  const orphaned = findOrphanedTopics(records, existingTopics);

  const outcomes = records.length
    ? await db
        .insert(topic)
        .values(records)
        .onConflictDoUpdate({
          target: topic.id,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            updatedAt: sql`now()`,
          },
          // Only rewrite the row (and bump updatedAt) when the incoming record actually
          // disagrees with what's stored — otherwise a no-op re-run would still touch every
          // row's timestamp.
          setWhere: sql`${topic.slug} IS DISTINCT FROM excluded.slug OR ${topic.title} IS DISTINCT FROM excluded.title OR ${topic.description} IS DISTINCT FROM excluded.description`,
        })
        // xmax = 0 is the standard postgres upsert idiom for "this row was just inserted, not
        // updated" — a fresh tuple has never been superseded, so its xmax is unset.
        .returning({ id: topic.id, wasInsert: sql<boolean>`xmax = 0` })
    : [];

  return { summary: summarizeUpsert(records.length, outcomes), orphaned };
}

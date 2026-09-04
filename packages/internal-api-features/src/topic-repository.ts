import { type Database, schema, type Topic } from '@fphd/db';
import { eq, sql } from 'drizzle-orm';

const { indicatorTopic, topic } = schema;

/** Writes address a topic by id rather than slug, because the slug is itself editable. */
export async function getTopicById(db: Database, id: string): Promise<Topic | undefined> {
  const rows = await db.select().from(topic).where(eq(topic.id, id));
  return rows[0];
}

export type TopicUpdate = Pick<Topic, 'description' | 'slug' | 'title'>;

export type CreateTopicResult = { ok: true; topic: Topic } | { ok: false; reason: 'slug_taken' };

export type UpdateTopicResult =
  | { ok: true; topic: Topic; changed: boolean }
  | { ok: false; reason: 'not_found' | 'slug_taken' };

export type DeleteTopicResult = { ok: true } | { ok: false; reason: 'not_found' };

const UNIQUE_VIOLATION = '23505';

/** Drizzle wraps the driver error, so the SQLSTATE is on a `cause` rather than the error thrown. */
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
 * Apply an edit to one topic. Both failures come back as values because a form has to render
 * them. The row lock makes the unchanged check safe: without it two concurrent saves both read
 * the old row, and the later one overwrites the earlier having judged itself a change.
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

      // Named columns only: the id and creation timestamp stay the database's to set.
      const [updated] = await tx
        .update(topic)
        .set({ ...update, updatedAt: sql`now()` })
        .where(eq(topic.id, id))
        .returning();

      if (updated === undefined) {
        // The row is locked, so a miss means the update matched something other than the row read.
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
 * Insert a topic, letting the database mint the id (UUIDv7) and both timestamps. A slug held
 * by another topic comes back as a value because a form has to render it against the field.
 */
export async function createTopic(
  db: Database,
  { description, slug, title }: TopicUpdate,
): Promise<CreateTopicResult> {
  try {
    const [created] = await db.insert(topic).values({ description, slug, title }).returning();

    if (created === undefined) throw new Error('createTopic inserted no row');

    return { ok: true, topic: created };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}

/**
 * Delete a topic and the indicator_topic links that reference it, in one transaction. The
 * links go first or the foreign key refuses the topic delete; the indicators themselves stay.
 */
export async function deleteTopic(db: Database, id: string): Promise<DeleteTopicResult> {
  return db.transaction(async (tx) => {
    await tx.delete(indicatorTopic).where(eq(indicatorTopic.topicId, id));

    const deleted = await tx.delete(topic).where(eq(topic.id, id)).returning({ id: topic.id });

    return deleted.length === 0 ? { ok: false, reason: 'not_found' } : { ok: true };
  });
}

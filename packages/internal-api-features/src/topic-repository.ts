import { type Database, schema } from '@fphd/db';
import { type Actor, changesBetween, listChanges, recordAudit } from '@fphd/db/audit-log';
import { eq, sql } from 'drizzle-orm';

const { indicatorVersionTopic, topic } = schema;

/** A topic row with its writers, which only the internal surface reads. */
export type TopicRow = typeof topic.$inferSelect;

/** Writes address a topic by id rather than slug, because the slug is itself editable. */
export async function getTopicById(db: Database, id: string): Promise<TopicRow | undefined> {
  const rows = await db.select().from(topic).where(eq(topic.id, id));
  return rows[0];
}

export type TopicUpdate = Pick<TopicRow, 'description' | 'slug' | 'title'>;

export type CreateTopicResult = { ok: true; topic: TopicRow } | { ok: false; reason: 'slug_taken' };

export type UpdateTopicResult =
  | { ok: true; topic: TopicRow; changed: boolean }
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

function matches(current: TopicRow, update: TopicUpdate): boolean {
  return (
    current.slug === update.slug &&
    current.title === update.title &&
    current.description === update.description
  );
}

/**
 * The row lock makes the unchanged check safe: without it two concurrent saves both read the
 * old row, and the later one overwrites the earlier as a change.
 */
export async function updateTopic(
  db: Database,
  id: string,
  { description, slug, title }: TopicUpdate,
  actor: Actor,
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
        .set({ ...update, updatedAt: sql`now()`, updatedBy: actor.userId })
        .where(eq(topic.id, id))
        .returning();

      if (updated === undefined) {
        // The row is locked, so a miss means the update matched something other than the row read.
        throw new Error(`updateTopic locked topic ${id} but updated no row`);
      }

      await recordAudit(tx, actor, [
        { action: 'topic.updated', entityId: id, changes: changesBetween(current, updated) },
      ]);

      return { ok: true, topic: updated, changed: true };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}

/** The database mints the id (UUIDv7) and both timestamps. */
export async function createTopic(
  db: Database,
  { description, slug, title }: TopicUpdate,
  actor: Actor,
): Promise<CreateTopicResult> {
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(topic)
        .values({ description, slug, title, createdBy: actor.userId, updatedBy: actor.userId })
        .returning();

      if (created === undefined) throw new Error('createTopic inserted no row');

      await recordAudit(tx, actor, [
        { action: 'topic.created', entityId: created.id, changes: changesBetween(null, created) },
      ]);

      return { ok: true, topic: created };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}

/**
 * The links go first or the foreign key refuses the delete; the indicators themselves stay. The
 * entry records the versions the topic is removed from.
 */
export async function deleteTopic(
  db: Database,
  id: string,
  actor: Actor,
): Promise<DeleteTopicResult> {
  return db.transaction(async (tx) => {
    const links = await tx
      .delete(indicatorVersionTopic)
      .where(eq(indicatorVersionTopic.topicId, id))
      .returning({ versionId: indicatorVersionTopic.indicatorVersionId });

    const [deleted] = await tx.delete(topic).where(eq(topic.id, id)).returning();

    if (deleted === undefined) return { ok: false, reason: 'not_found' };

    const indicatorVersionIds = links.map(({ versionId }) => versionId);
    await recordAudit(tx, actor, [
      {
        action: 'topic.deleted',
        entityId: id,
        changes: {
          ...changesBetween(deleted, null),
          ...listChanges({ indicatorVersionIds }, { indicatorVersionIds: [] }),
        },
      },
    ]);

    return { ok: true };
  });
}

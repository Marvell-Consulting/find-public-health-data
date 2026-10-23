import { type Database, schema } from '@fphd/db';
import { auditEntriesFor } from '@fphd/db/testing';
import { eq } from 'drizzle-orm';
import { describe, expect } from 'vitest';

import {
  AS_ACTOR,
  indicatorWithTwoPublications,
  newDraft,
  repositoryTest,
} from './indicator-repository.testing.ts';
import {
  countLinkedIndicators,
  createTopic,
  deleteTopic,
  getTopicById,
} from './topic-repository.ts';

const { indicatorVersionSubtopic, indicatorVersionTopic, subtopic } = schema;

async function newTopic(db: Database, slug: string): Promise<string> {
  const created = await createTopic(
    db,
    { slug, title: `Topic ${slug}`, description: `About ${slug}.` },
    AS_ACTOR,
  );
  if (!created.ok) throw new Error(`createTopic refused ${slug}`);
  return created.topic.id;
}

async function link(db: Database, topicId: string, ...versionIds: string[]) {
  await db
    .insert(indicatorVersionTopic)
    .values(versionIds.map((indicatorVersionId) => ({ indicatorVersionId, topicId })));
}

async function linkedVersionIds(db: Database, topicId: string): Promise<string[]> {
  const rows = await db
    .select({ id: indicatorVersionTopic.indicatorVersionId })
    .from(indicatorVersionTopic)
    .where(eq(indicatorVersionTopic.topicId, topicId));
  return rows.map(({ id }) => id);
}

describe('deleteTopic with linked indicators', () => {
  repositoryTest(
    'preserves subtopic placements when refusing a linked topic delete',
    async ({ db }) => {
      const { versionId } = await newDraft(db, 'Linked subtopic');
      const topicId = await newTopic(db, 'linked-subtopic');
      await link(db, topicId, versionId);
      const [child] = await db
        .insert(subtopic)
        .values({ topicId, slug: 'linked', title: 'Linked subtopic' })
        .returning();
      if (!child) throw new Error('Subtopic fixture missing');
      await db
        .insert(indicatorVersionSubtopic)
        .values({ topicId, subtopicId: child.id, indicatorVersionId: versionId });
      expect(await deleteTopic(db, topicId, AS_ACTOR)).toEqual({ ok: false, reason: 'in_use' });
      expect(
        await db
          .select()
          .from(indicatorVersionSubtopic)
          .where(eq(indicatorVersionSubtopic.subtopicId, child.id)),
      ).toHaveLength(1);
      expect(await db.select().from(subtopic).where(eq(subtopic.id, child.id))).toHaveLength(1);
    },
  );

  repositoryTest('audits the subtopics removed with an unused topic', async ({ db }) => {
    const topicId = await newTopic(db, 'unused-subtopic');
    const [child] = await db
      .insert(subtopic)
      .values({ topicId, slug: 'unused', title: 'Unused subtopic' })
      .returning();
    if (!child) throw new Error('Subtopic fixture missing');
    expect(await deleteTopic(db, topicId, AS_ACTOR)).toEqual({ ok: true });
    expect(await db.select().from(subtopic).where(eq(subtopic.id, child.id))).toHaveLength(0);
    expect(await auditEntriesFor(db, topicId)).toContainEqual(
      expect.objectContaining({
        action: 'topic.deleted',
        changes: expect.objectContaining({ subtopicIds: { before: [child.id], after: [] } }),
      }),
    );
  });

  const linkedVersions = [
    ['a draft', async (db: Database) => (await newDraft(db, 'Linked draft')).versionId],
    [
      'the current published version',
      async (db: Database) => (await indicatorWithTwoPublications(db, 'Linked current')).currentId,
    ],
    [
      'an earlier published version',
      async (db: Database) =>
        (await indicatorWithTwoPublications(db, 'Linked earlier')).supersededId,
    ],
  ] as const;

  repositoryTest.for(linkedVersions)(
    'refuses to delete a topic %s links to, and keeps every link',
    async ([, versionOf], { db }) => {
      const versionId = await versionOf(db);
      const topicId = await newTopic(db, `linked-${versionId}`);
      await link(db, topicId, versionId);

      expect(await deleteTopic(db, topicId, AS_ACTOR)).toEqual({ ok: false, reason: 'in_use' });

      expect(await getTopicById(db, topicId)).toBeDefined();
      expect(await linkedVersionIds(db, topicId)).toEqual([versionId]);
      expect((await auditEntriesFor(db, topicId)).map(({ action }) => action)).toEqual([
        'topic.created',
      ]);
    },
  );
});

describe('countLinkedIndicators', () => {
  repositoryTest('is 0 for a topic nothing links to', async ({ db }) => {
    expect(await countLinkedIndicators(db, await newTopic(db, 'count-none'))).toBe(0);
  });

  repositoryTest('counts an indicator once, however many of its versions link', async ({ db }) => {
    const { currentId, supersededId } = await indicatorWithTwoPublications(db, 'Counted once');
    const topicId = await newTopic(db, 'count-once');
    await link(db, topicId, currentId, supersededId);

    expect(await countLinkedIndicators(db, topicId)).toBe(1);
  });

  repositoryTest('counts drafts and publications of different indicators', async ({ db }) => {
    const draft = await newDraft(db, 'Counted draft');
    const { supersededId } = await indicatorWithTwoPublications(db, 'Counted publication');
    const topicId = await newTopic(db, 'count-both');
    await link(db, topicId, draft.versionId, supersededId);

    expect(await countLinkedIndicators(db, topicId)).toBe(2);
  });
});

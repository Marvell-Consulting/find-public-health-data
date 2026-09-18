import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDraftFromPublished,
  createIndicatorDraft,
  getIndicatorById,
  listIndicatorsPage,
  updateIndicatorDraft,
} from './indicator-repository.ts';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

let testDb: TestDatabase;
let db: Database;
// Captured before any test writes, so the later cases still know what the seed held.
let seededIds: string[];

// The seed carries the lookup rows an indicator references, which the schema template lacks.
beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });
  seededIds = await idsNewestFirst();
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

const { classification, indicator, indicatorClassification, indicatorTopic, indicatorVersion } =
  schema;

const ACTOR = 'integration-test';

/** The dashboard's order, stated in SQL so the test does not lean on the code it checks. */
async function idsNewestFirst(): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT i.id
    FROM indicator i
    LEFT JOIN indicator_version d ON d.indicator_id = i.id AND d.status = 'draft'
    LEFT JOIN indicator_version p ON p.indicator_id = i.id AND p.status = 'published'
    ORDER BY greatest(d.updated_at, p.updated_at) DESC, coalesce(d.name, p.name), i.id
  `)) as unknown as { id: string }[];

  return rows.map((row) => row.id);
}

async function publishedVersionId(indicatorId: string): Promise<string> {
  const [row] = await db
    .select({ id: indicatorVersion.id })
    .from(indicatorVersion)
    .where(
      and(eq(indicatorVersion.indicatorId, indicatorId), eq(indicatorVersion.status, 'published')),
    );
  if (!row) throw new Error(`indicator ${indicatorId} has no published version`);
  return row.id;
}

async function topicIdsOf(versionId: string): Promise<string[]> {
  const rows = await db
    .select({ topicId: indicatorTopic.topicId })
    .from(indicatorTopic)
    .where(eq(indicatorTopic.indicatorVersionId, versionId));
  return rows.map(({ topicId }) => topicId).sort();
}

describe('listIndicatorsPage', () => {
  it('pages through every indicator, most recently edited first', async () => {
    const expected = await idsNewestFirst();
    const pageSize = Math.ceil(expected.length / 2);

    const first = await listIndicatorsPage(db, 1, pageSize);
    const second = await listIndicatorsPage(db, 2, pageSize);

    expect(first.total).toBe(expected.length);
    expect(second.total).toBe(expected.length);
    expect([...first.indicators, ...second.indicators].map((row) => row.id)).toEqual(expected);
  });

  it('returns an empty page past the end, still reporting the total', async () => {
    const expected = await idsNewestFirst();

    const page = await listIndicatorsPage(db, 2, expected.length);

    expect(page.indicators).toEqual([]);
    expect(page.total).toBe(expected.length);
  });

  it('includes an indicator with no published version, which the public listing hides', async () => {
    const created = await createIndicatorDraft(db, { name: 'A draft-only indicator' }, ACTOR);

    const page = await listIndicatorsPage(db, 1, 1);

    expect(page.indicators[0]).toMatchObject({
      id: created.indicatorId,
      name: 'A draft-only indicator',
    });
  });
});

describe('getIndicatorById', () => {
  it('derives published from the versions, with the public number', async () => {
    const target = seededIds[0];
    if (target === undefined) throw new Error('The seed holds no indicators');

    const found = await getIndicatorById(db, target);

    expect(found).toMatchObject({ id: target, status: 'published' });
    expect(found?.shortId).toEqual(expect.any(Number));
    expect(found?.name).not.toBe('');
  });

  it('derives draft once a draft version exists, and prefers its name', async () => {
    const target = seededIds.at(-1);
    if (target === undefined) throw new Error('The seed holds no indicators');

    await createDraftFromPublished(db, target, ACTOR);
    await updateIndicatorDraft(db, target, { name: 'Edited in a draft' }, {}, ACTOR);

    expect(await getIndicatorById(db, target)).toMatchObject({
      status: 'draft',
      name: 'Edited in a draft',
    });
  });

  it('returns nothing for an id no indicator has', async () => {
    expect(await getIndicatorById(db, '00000000-0000-7000-8000-000000000000')).toBeUndefined();
  });
});

describe('createIndicatorDraft', () => {
  it('mints an identity with a short id and one draft version', async () => {
    const created = await createIndicatorDraft(db, { name: 'A brand new indicator' }, ACTOR);

    const [identity] = await db
      .select()
      .from(indicator)
      .where(eq(indicator.id, created.indicatorId));
    const versions = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.indicatorId, created.indicatorId));

    expect(identity?.shortId).toBe(created.shortId);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      id: created.versionId,
      status: 'draft',
      name: 'A brand new indicator',
      createdBy: ACTOR,
      updatedBy: ACTOR,
    });
  });
});

describe('updateIndicatorDraft', () => {
  it('rewrites the draft columns and replaces its memberships', async () => {
    const created = await createIndicatorDraft(db, { name: 'Before' }, ACTOR);
    const [topic] = await db.select({ id: schema.topic.id }).from(schema.topic).limit(1);
    const [classified] = await db.select({ id: classification.id }).from(classification).limit(1);
    if (!topic || !classified) throw new Error('The seed holds no topics or classifications');

    const result = await updateIndicatorDraft(
      db,
      created.indicatorId,
      { name: 'After', definition: 'A definition' },
      { topicIds: [topic.id], classificationIds: [classified.id] },
      'someone-else',
    );

    expect(result).toEqual({ ok: true });
    const [version] = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.id, created.versionId));
    expect(version).toMatchObject({
      name: 'After',
      definition: 'A definition',
      createdBy: ACTOR,
      updatedBy: 'someone-else',
    });
    expect(await topicIdsOf(created.versionId)).toEqual([topic.id]);

    await updateIndicatorDraft(db, created.indicatorId, {}, { topicIds: [] }, ACTOR);

    expect(await topicIdsOf(created.versionId)).toEqual([]);
  });

  it('refuses an indicator with no draft', async () => {
    const created = await createIndicatorDraft(db, { name: 'Draftless' }, ACTOR);
    await db.delete(indicatorVersion).where(eq(indicatorVersion.indicatorId, created.indicatorId));

    await expect(updateIndicatorDraft(db, created.indicatorId, {}, {}, ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'no_draft',
    });
  });
});

describe('createDraftFromPublished', () => {
  it('copies the published version columns and memberships into a new draft', async () => {
    const target = seededIds[0];
    if (target === undefined) throw new Error('The seed holds no indicators');
    const publishedId = await publishedVersionId(target);
    const publishedTopics = await topicIdsOf(publishedId);
    expect(publishedTopics.length).toBeGreaterThan(0);

    const result = await createDraftFromPublished(db, target, ACTOR);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('expected a draft');

    const [published] = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.id, publishedId));
    const [draft] = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.id, result.versionId));

    expect(draft).toMatchObject({
      indicatorId: target,
      status: 'draft',
      publishedAt: null,
      name: published?.name,
      definition: published?.definition,
      valueTypeId: published?.valueTypeId,
      createdBy: ACTOR,
    });
    expect(await topicIdsOf(result.versionId)).toEqual(publishedTopics);
  });

  it('refuses a second draft for the same indicator', async () => {
    const target = seededIds[0];
    if (target === undefined) throw new Error('The seed holds no indicators');

    await expect(createDraftFromPublished(db, target, ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'draft_exists',
    });
  });

  it('refuses an indicator with nothing published', async () => {
    const created = await createIndicatorDraft(db, { name: 'Never published' }, ACTOR);

    await expect(createDraftFromPublished(db, created.indicatorId, ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'not_published',
    });
  });
});

describe('indicator_classification', () => {
  it('follows the draft rather than the indicator', async () => {
    const created = await createIndicatorDraft(db, { name: 'Classified' }, ACTOR);
    const [classified] = await db.select({ id: classification.id }).from(classification).limit(1);
    if (!classified) throw new Error('The seed holds no classifications');

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      {},
      { classificationIds: [classified.id] },
      ACTOR,
    );

    const rows = await db
      .select({ versionId: indicatorClassification.indicatorVersionId })
      .from(indicatorClassification)
      .where(eq(indicatorClassification.indicatorVersionId, created.versionId));

    expect(rows).toEqual([{ versionId: created.versionId }]);
  });
});

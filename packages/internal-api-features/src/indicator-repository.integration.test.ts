import { appEnvFields, parseEnv, z } from '@fphd/config';
import {
  createDb,
  type Database,
  dbEnvFields,
  listIndicatorFacets,
  resolveDbTls,
  schema,
} from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { and, desc, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type CreatedIndicatorDraft,
  createDraftFromPublished,
  createIndicatorDraft,
  getIndicatorById,
  getIndicatorDraftState,
  listIndicatorsPage,
  SLUG_LOCK_NAMESPACE,
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

/** Every case here names its indicator distinctly, so the slug is free. */
async function newDraft(name: string): Promise<CreatedIndicatorDraft> {
  const created = await createIndicatorDraft(db, { name }, ACTOR);
  if (!created.ok) throw new Error(`createIndicatorDraft refused the name: ${created.reason}`);
  return created;
}

async function slugOf(versionId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ slug: indicatorVersion.slug })
    .from(indicatorVersion)
    .where(eq(indicatorVersion.id, versionId));
  return row?.slug;
}

/** The dashboard's order, stated in SQL so the test does not lean on the code it checks. */
async function idsNewestFirst(): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT i.id
    FROM indicator i
    LEFT JOIN indicator_version d ON d.indicator_id = i.id AND d.status = 'draft'
    LEFT JOIN LATERAL (
      SELECT pv.* FROM indicator_version pv
      WHERE pv.indicator_id = i.id AND pv.status = 'published'
      ORDER BY pv.published_at DESC NULLS LAST, pv.id DESC
      LIMIT 1
    ) p ON true
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
    )
    .orderBy(sql`${indicatorVersion.publishedAt} desc nulls last`, desc(indicatorVersion.id))
    .limit(1);
  if (!row) throw new Error(`indicator ${indicatorId} has no published version`);
  return row.id;
}

let publications = 0;

/**
 * An indicator with two published versions whose id order disagrees with their publication
 * order: the superseded one is written last, so only published_at picks out the current one.
 * Each call names its own, because a slug belongs to one indicator.
 */
async function indicatorWithTwoPublications(): Promise<{
  indicatorId: string;
  currentId: string;
  supersededId: string;
  currentName: string;
  currentSlug: string;
}> {
  const nth = ++publications;
  const currentName = `Current publication ${nth}`;
  const created = await newDraft(currentName);
  await db
    .update(indicatorVersion)
    .set({
      status: 'published',
      publishedAt: new Date('2030-01-01T00:00:00Z'),
      updatedAt: new Date('2030-01-01T00:00:00Z'),
    })
    .where(eq(indicatorVersion.id, created.versionId));

  const [superseded] = await db
    .insert(indicatorVersion)
    .values({
      indicatorId: created.indicatorId,
      status: 'published',
      name: `Superseded publication ${nth}`,
      slug: `superseded-publication-${nth}`,
      publishedAt: new Date('2029-01-01T00:00:00Z'),
      createdBy: ACTOR,
      updatedBy: ACTOR,
    })
    .returning({ id: indicatorVersion.id });
  if (!superseded) throw new Error('inserted no version');

  return {
    indicatorId: created.indicatorId,
    currentId: created.versionId,
    supersededId: superseded.id,
    currentName,
    currentSlug: `current-publication-${nth}`,
  };
}

async function topicIdsOf(versionId: string): Promise<string[]> {
  const rows = await db
    .select({ topicId: indicatorTopic.topicId })
    .from(indicatorTopic)
    .where(eq(indicatorTopic.indicatorVersionId, versionId));
  return rows.map(({ topicId }) => topicId).sort();
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Sessions in this test's database waiting on a slug lock. */
async function slugLockWaiters(): Promise<number> {
  const [row] = (await db.execute(sql`
    SELECT count(*)::int AS waiting FROM pg_locks
    WHERE locktype = 'advisory' AND NOT granted AND classid = ${SLUG_LOCK_NAMESPACE}::oid
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
  `)) as unknown as { waiting: number }[];
  return row?.waiting ?? 0;
}

/**
 * Starts `write` while another transaction holds the slug's lock, having done `hold` first,
 * and answers what the write returns once that transaction commits. The write must be seen
 * waiting on the lock, so a write that skips it fails here rather than racing.
 */
async function writeWhileSlugHeld<Result>(
  slug: string,
  write: () => Promise<Result>,
  hold: (tx: Transaction) => Promise<unknown> = async () => {},
): Promise<Result> {
  // Wrapped, or the transaction would await the write that is waiting for it to commit.
  const { pending } = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SLUG_LOCK_NAMESPACE}, hashtext(${slug}))`);
    await hold(tx);
    const pending = write();
    await expect.poll(slugLockWaiters).toBe(1);
    return { pending };
  });

  return pending;
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
    // The API serialises this, so a driver string rather than a Date is a 500.
    expect(first.indicators[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it('returns an empty page past the end, still reporting the total', async () => {
    const expected = await idsNewestFirst();

    const page = await listIndicatorsPage(db, 2, expected.length);

    expect(page.indicators).toEqual([]);
    expect(page.total).toBe(expected.length);
  });

  it('includes an indicator with no published version, which the public listing hides', async () => {
    const created = await newDraft('A draft-only indicator');

    const page = await listIndicatorsPage(db, 1, 1);

    expect(page.indicators[0]).toMatchObject({
      id: created.indicatorId,
      name: 'A draft-only indicator',
    });
  });
});

describe('the derived statuses', () => {
  /** The whole listing, so a case finds its own row wherever the order put it. */
  async function listed(id: string) {
    const page = await listIndicatorsPage(db, 1, (await idsNewestFirst()).length);
    return page.indicators.find((row) => row.id === id);
  }

  it('reads a draft with nothing published as new and unsubmitted', async () => {
    const created = await newDraft('A first draft');
    const statuses = { indicatorStatus: 'new', draftStatus: 'draft' };

    expect(await listed(created.indicatorId)).toMatchObject(statuses);
    expect(await getIndicatorById(db, created.indicatorId)).toMatchObject(statuses);
  });

  it('reads a published indicator with no draft as live and nothing in flight', async () => {
    const { indicatorId } = await indicatorWithTwoPublications();
    const statuses = { indicatorStatus: 'live', draftStatus: null };

    expect(await listed(indicatorId)).toMatchObject(statuses);
    expect(await getIndicatorById(db, indicatorId)).toMatchObject(statuses);
  });

  it('reads a draft of a published indicator as live with an unsubmitted draft', async () => {
    const { indicatorId } = await indicatorWithTwoPublications();
    await createDraftFromPublished(db, indicatorId, ACTOR);
    const statuses = { indicatorStatus: 'live', draftStatus: 'draft' };

    expect(await listed(indicatorId)).toMatchObject(statuses);
    expect(await getIndicatorById(db, indicatorId)).toMatchObject(statuses);
  });
});

describe('getIndicatorById', () => {
  it('reads an indicator by its row id, with the public number', async () => {
    const target = seededIds[0];
    if (target === undefined) throw new Error('The seed holds no indicators');

    const found = await getIndicatorById(db, target);

    expect(found).toMatchObject({ id: target, indicatorStatus: 'live' });
    expect(found?.updatedAt).toBeInstanceOf(Date);
    expect(found?.shortId).toEqual(expect.any(Number));
    expect(found?.name).not.toBe('');
  });

  it('prefers the draft name once a draft version exists', async () => {
    const target = seededIds.at(-1);
    if (target === undefined) throw new Error('The seed holds no indicators');

    await createDraftFromPublished(db, target, ACTOR);
    await updateIndicatorDraft(db, target, { name: 'Edited in a draft' }, {}, ACTOR);

    expect(await getIndicatorById(db, target)).toMatchObject({
      draftStatus: 'draft',
      name: 'Edited in a draft',
    });
  });

  it('reads the most recently published version when several exist', async () => {
    const { indicatorId, currentId, currentName, currentSlug, supersededId } =
      await indicatorWithTwoPublications();

    const found = await getIndicatorById(db, indicatorId);

    expect(supersededId > currentId).toBe(true);
    expect(found).toMatchObject({
      name: currentName,
      publishedSlug: currentSlug,
    });
    expect(found?.updatedAt.toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  it('returns nothing for an id no indicator has', async () => {
    expect(await getIndicatorById(db, '00000000-0000-7000-8000-000000000000')).toBeUndefined();
  });
});

describe('createIndicatorDraft', () => {
  it('mints an identity with a short id and one draft version', async () => {
    const created = await newDraft('A brand new indicator');

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
      slug: 'a-brand-new-indicator',
      createdBy: ACTOR,
      updatedBy: ACTOR,
    });
  });

  it('refuses a name whose slug another indicator already holds', async () => {
    await newDraft('A contested name');

    await expect(createIndicatorDraft(db, { name: 'A contested name' }, ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'slug_taken',
    });
  });

  it('waits for another writer of the slug, then creates', async () => {
    const result = await writeWhileSlugHeld('a-held-name', () =>
      createIndicatorDraft(db, { name: 'A held name' }, ACTOR),
    );

    expect(result).toMatchObject({ ok: true });
  });

  it('refuses a name whose slug a writer it waited for has taken', async () => {
    const result = await writeWhileSlugHeld(
      'a-name-created-twice',
      () => createIndicatorDraft(db, { name: 'A name created twice' }, ACTOR),
      async (tx) => {
        const [identity] = await tx.insert(indicator).values({}).returning({ id: indicator.id });
        if (!identity) throw new Error('inserted no indicator');
        await tx.insert(indicatorVersion).values({
          indicatorId: identity.id,
          status: 'draft',
          name: 'A name created twice',
          slug: 'a-name-created-twice',
          createdBy: ACTOR,
          updatedBy: ACTOR,
        });
      },
    );

    expect(result).toEqual({ ok: false, reason: 'slug_taken' });
  });
});

describe('updateIndicatorDraft', () => {
  it('rewrites the draft columns and replaces its memberships', async () => {
    const created = await newDraft('Before');
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

  it('re-slugs a renamed draft', async () => {
    const created = await newDraft('An early name');

    await updateIndicatorDraft(db, created.indicatorId, { name: 'A later name' }, {}, ACTOR);

    expect(await slugOf(created.versionId)).toBe('a-later-name');
  });

  it('keeps the published slug on every version when the draft is renamed', async () => {
    const { indicatorId, currentId, currentSlug } = await indicatorWithTwoPublications();
    const opened = await createDraftFromPublished(db, indicatorId, ACTOR);
    if (!opened.ok) throw new Error('expected a draft');

    await updateIndicatorDraft(db, indicatorId, { name: 'Renamed in the draft' }, {}, ACTOR);

    expect(await slugOf(currentId)).toBe(currentSlug);
    expect(await slugOf(opened.versionId)).toBe(currentSlug);
    expect(await getIndicatorById(db, indicatorId)).toMatchObject({
      name: 'Renamed in the draft',
      publishedSlug: currentSlug,
    });
  });

  it('refuses an unusable name even though a published indicator keeps its slug', async () => {
    const { indicatorId } = await indicatorWithTwoPublications();
    await createDraftFromPublished(db, indicatorId, ACTOR);

    await expect(
      updateIndicatorDraft(db, indicatorId, { name: '2024' }, {}, ACTOR),
    ).rejects.toThrow('no usable slug');
  });

  it("refuses a rename onto another indicator's slug", async () => {
    await newDraft('An occupied name');
    const created = await newDraft('A free name');

    await expect(
      updateIndicatorDraft(db, created.indicatorId, { name: 'An occupied name' }, {}, ACTOR),
    ).resolves.toEqual({ ok: false, reason: 'slug_taken' });
  });

  it('refuses a rename onto a slug a writer it waited for has taken', async () => {
    const first = await newDraft('First of two renames');
    const second = await newDraft('Second of two renames');

    const result = await writeWhileSlugHeld(
      'a-name-both-want',
      () => updateIndicatorDraft(db, second.indicatorId, { name: 'A name both want' }, {}, ACTOR),
      (tx) =>
        tx
          .update(indicatorVersion)
          .set({ name: 'A name both want', slug: 'a-name-both-want' })
          .where(eq(indicatorVersion.id, first.versionId)),
    );

    expect(result).toEqual({ ok: false, reason: 'slug_taken' });
  });

  // Two renames swapping slugs each wait on the other's exclusion check unless the slug a
  // rename leaves is held as well as the one it takes.
  it('waits for another writer of the slug it leaves, then renames', async () => {
    const created = await newDraft('A name being left');

    const result = await writeWhileSlugHeld('a-name-being-left', () =>
      updateIndicatorDraft(db, created.indicatorId, { name: 'A name moved to' }, {}, ACTOR),
    );

    expect(result).toEqual({ ok: true });
    expect(await slugOf(created.versionId)).toBe('a-name-moved-to');
  });

  it('leaves the memberships alone when the update names none', async () => {
    const created = await newDraft('Keeps its links');
    const [topic] = await db.select({ id: schema.topic.id }).from(schema.topic).limit(1);
    const [classified] = await db.select({ id: classification.id }).from(classification).limit(1);
    if (!topic || !classified) throw new Error('The seed holds no topics or classifications');
    await updateIndicatorDraft(
      db,
      created.indicatorId,
      {},
      { topicIds: [topic.id], classificationIds: [classified.id] },
      ACTOR,
    );

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { name: 'Keeps its links renamed' },
      {},
      ACTOR,
    );

    expect(await topicIdsOf(created.versionId)).toEqual([topic.id]);
    const classifications = await db
      .select({ id: indicatorClassification.classificationId })
      .from(indicatorClassification)
      .where(eq(indicatorClassification.indicatorVersionId, created.versionId));
    expect(classifications).toEqual([{ id: classified.id }]);
  });

  it("writes a section's answers to the draft alone, leaving its name and slug", async () => {
    const { indicatorId, currentId, currentName, currentSlug } =
      await indicatorWithTwoPublications();
    const opened = await createDraftFromPublished(db, indicatorId, ACTOR);
    if (!opened.ok) throw new Error('expected a draft');
    const [published] = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.id, currentId));

    const result = await updateIndicatorDraft(
      db,
      indicatorId,
      { definition: 'A new definition', rationale: 'A new rationale' },
      {},
      'someone-else',
    );

    expect(result).toEqual({ ok: true });
    const state = await getIndicatorDraftState(db, indicatorId);
    expect(state?.draft).toMatchObject({
      name: currentName,
      slug: currentSlug,
      definition: 'A new definition',
      rationale: 'A new rationale',
      updatedBy: 'someone-else',
    });
    const [after] = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.id, currentId));
    expect(after).toEqual(published);
  });

  it('writes who calculated the indicator, and clears the other organisations on request', async () => {
    const created = await newDraft('Calculated by others');

    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { methodology: 'A method', calculatedBy: 'other', calculatedByOther: 'ONS' },
      {},
      ACTOR,
    );
    const asOther = await getIndicatorDraftState(db, created.indicatorId);
    await updateIndicatorDraft(
      db,
      created.indicatorId,
      { calculatedBy: 'dhsc', calculatedByOther: null },
      {},
      ACTOR,
    );
    const asDhsc = await getIndicatorDraftState(db, created.indicatorId);

    expect(asOther?.draft).toMatchObject({
      methodology: 'A method',
      calculatedBy: 'other',
      calculatedByOther: 'ONS',
    });
    expect(asDhsc?.draft).toMatchObject({
      methodology: 'A method',
      calculatedBy: 'dhsc',
      calculatedByOther: null,
    });
  });

  it('refuses an indicator with no draft', async () => {
    const created = await newDraft('Draftless');
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
      slug: published?.slug,
      definition: published?.definition,
      valueTypeId: published?.valueTypeId,
      createdBy: ACTOR,
    });
    expect(await topicIdsOf(result.versionId)).toEqual(publishedTopics);
  });

  it('copies who calculated the published version', async () => {
    const { indicatorId, currentId } = await indicatorWithTwoPublications();
    await db
      .update(indicatorVersion)
      .set({ calculatedBy: 'other', calculatedByOther: 'ONS' })
      .where(eq(indicatorVersion.id, currentId));

    await createDraftFromPublished(db, indicatorId, ACTOR);

    const state = await getIndicatorDraftState(db, indicatorId);
    expect(state?.draft).toMatchObject({ calculatedBy: 'other', calculatedByOther: 'ONS' });
  });

  it('copies the most recently published version, not the superseded one', async () => {
    const { indicatorId, currentId, currentName, supersededId } =
      await indicatorWithTwoPublications();
    const [current, superseded] = await db
      .select({ id: schema.topic.id })
      .from(schema.topic)
      .limit(2);
    if (!current || !superseded) throw new Error('The seed holds too few topics');
    await db.insert(indicatorTopic).values([
      { topicId: current.id, indicatorVersionId: currentId },
      { topicId: superseded.id, indicatorVersionId: supersededId },
    ]);

    const result = await createDraftFromPublished(db, indicatorId, ACTOR);

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('expected a draft');
    const [draft] = await db
      .select()
      .from(indicatorVersion)
      .where(eq(indicatorVersion.id, result.versionId));
    expect(draft?.name).toBe(currentName);
    expect(await topicIdsOf(result.versionId)).toEqual([current.id]);
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
    const created = await newDraft('Never published');

    await expect(createDraftFromPublished(db, created.indicatorId, ACTOR)).resolves.toEqual({
      ok: false,
      reason: 'not_published',
    });
  });
});

describe('indicator_classification', () => {
  it('follows the draft rather than the indicator', async () => {
    const created = await newDraft('Classified');
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

describe('sharing one connection with the public repositories', () => {
  // internal-api serves both surfaces from one connection, and drizzle keys its column-name
  // cache on the unqualified relation name: the indicator table must not shadow the view.
  it('reads the indicator table and the published indicator view in one process', async () => {
    await listIndicatorsPage(db, 1, 1);

    await expect(listIndicatorFacets(db)).resolves.toMatchObject({
      sources: expect.any(Array),
      valueTypes: expect.any(Array),
    });
  });
});

describe('getIndicatorDraftState', () => {
  it('reads the draft of an indicator that has never been published', async () => {
    const created = await newDraft('A draft awaiting its first publication');

    const state = await getIndicatorDraftState(db, created.indicatorId);

    expect(state?.id).toBe(created.indicatorId);
    expect(state?.shortId).toBe(created.shortId);
    expect(state?.draft?.name).toBe('A draft awaiting its first publication');
    expect(state).toMatchObject({ indicatorStatus: 'new', draftStatus: 'draft' });
  });

  it('reports the published version behind a draft being revised', async () => {
    const published = await indicatorWithTwoPublications();
    await createDraftFromPublished(db, published.indicatorId, ACTOR);

    const state = await getIndicatorDraftState(db, published.indicatorId);

    expect(state?.draft?.name).toBe(published.currentName);
    expect(state).toMatchObject({ indicatorStatus: 'live', draftStatus: 'draft' });
  });

  it('reports no draft for a published indicator nobody is editing', async () => {
    const published = await indicatorWithTwoPublications();

    const state = await getIndicatorDraftState(db, published.indicatorId);

    expect(state?.draft).toBeNull();
    expect(state).toMatchObject({ indicatorStatus: 'live', draftStatus: null });
  });

  it('finds nothing for an indicator that does not exist', async () => {
    await expect(
      getIndicatorDraftState(db, '00000000-0000-7000-8000-000000000000'),
    ).resolves.toBeUndefined();
  });
});

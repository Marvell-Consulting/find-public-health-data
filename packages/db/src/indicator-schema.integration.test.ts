import { appEnvFields, parseEnv, z } from '@fphd/config';
import { SLUG_MAX_LENGTH } from '@fphd/utils/slug';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.ts';
import { dbEnvFields, resolveDbTls } from './env.ts';
import {
  ciMethod,
  classification,
  indicator,
  indicatorClassification,
  indicatorTopic,
  indicatorVersion,
  topic,
} from './schema/index.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

// Above every Fingertips number the seed carries over, the largest of which is 94,194.
const FIRST_MINTED_SHORT_ID = 100_000;

const UNIQUE_VIOLATION = '23505';
const NOT_NULL_VIOLATION = '23502';
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';

let testDb: TestDatabase;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

async function newIndicatorId(): Promise<string> {
  const [row] = await db.insert(indicator).values({}).returning({ id: indicator.id });
  if (!row) throw new Error('inserted no indicator');
  return row.id;
}

// A slug belongs to one indicator, so an unnamed version takes one keyed to its own. A
// published version says when, as the table insists, unless the caller says otherwise.
async function addVersion(
  indicatorId: string,
  status: 'draft' | 'published',
  values: Partial<
    Pick<
      typeof indicatorVersion.$inferInsert,
      'name' | 'slug' | 'publishedAt' | 'calculatedBy' | 'calculatedByOther'
    >
  > = {},
) {
  return db
    .insert(indicatorVersion)
    .values({
      indicatorId,
      status,
      name: 'Schema test indicator',
      slug: `schema-test-${indicatorId}`,
      publishedAt: status === 'published' ? new Date() : null,
      createdBy: 'schema-test',
      updatedBy: 'schema-test',
      ...values,
    })
    .returning();
}

async function newTopicId(slug: string): Promise<string> {
  const [row] = await db
    .insert(topic)
    .values({ slug, title: slug, description: slug })
    .returning({ id: topic.id });
  if (!row) throw new Error('inserted no topic');
  return row.id;
}

async function newClassificationId(slug: string): Promise<string> {
  const [row] = await db
    .insert(classification)
    .values({ dimension: 'population', slug, name: slug })
    .returning({ id: classification.id });
  if (!row) throw new Error('inserted no classification');
  return row.id;
}

describe('a stub indicator', () => {
  it('needs nothing but a name and an actor on its first draft', async () => {
    const indicatorId = await newIndicatorId();

    const [version] = await addVersion(indicatorId, 'draft');

    expect(indicatorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(version?.status).toBe('draft');
    expect(version?.name).toBe('Schema test indicator');
    expect(version?.valueTypeId).toBeNull();
    expect(version?.publishedAt).toBeNull();
  });

  it('takes its short id from the sequence, so the next one differs', async () => {
    const [first] = await db.insert(indicator).values({}).returning();
    const [second] = await db.insert(indicator).values({}).returning();

    expect(second?.shortId).toBeGreaterThanOrEqual(FIRST_MINTED_SHORT_ID);
    expect(second?.shortId).toBe((first?.shortId ?? 0) + 1);
  });
});

describe('indicator_version', () => {
  it('allows one draft per indicator', async () => {
    const indicatorId = await newIndicatorId();
    await addVersion(indicatorId, 'draft');

    await expect(addVersion(indicatorId, 'draft')).rejects.toMatchObject({
      cause: { code: UNIQUE_VIOLATION },
    });
  });

  it('allows several published versions per indicator', async () => {
    const indicatorId = await newIndicatorId();
    await addVersion(indicatorId, 'published');

    await expect(addVersion(indicatorId, 'published')).resolves.toHaveLength(1);
  });

  // Raw SQL because the insert type no longer lets a caller omit the name.
  it('refuses a version with no name', async () => {
    const indicatorId = await newIndicatorId();

    await expect(
      db.execute(
        sql`INSERT INTO indicator_version (indicator_id, created_by, updated_by)
            VALUES (${indicatorId}, 'schema-test', 'schema-test')`,
      ),
    ).rejects.toMatchObject({ cause: { code: NOT_NULL_VIOLATION } });
  });

  it('ties the publication timestamp to the status', async () => {
    const indicatorId = await newIndicatorId();

    await expect(addVersion(indicatorId, 'published', { publishedAt: null })).rejects.toMatchObject(
      { cause: { code: CHECK_VIOLATION } },
    );
    await expect(
      addVersion(indicatorId, 'draft', { publishedAt: new Date() }),
    ).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });

  it('holds a polarity only as one of the service values', async () => {
    const indicatorId = await newIndicatorId();
    const [draft] = await addVersion(indicatorId, 'draft');
    if (!draft) throw new Error('inserted no version');

    await db.execute(
      sql`UPDATE indicator_version SET polarity = 'no-polarity' WHERE id = ${draft.id}`,
    );
    await expect(
      db.execute(
        sql`UPDATE indicator_version SET polarity = 'RAG - Low is good' WHERE id = ${draft.id}`,
      ),
    ).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });

  it('holds an update frequency only as one of the service values', async () => {
    const indicatorId = await newIndicatorId();
    const [draft] = await addVersion(indicatorId, 'draft');
    if (!draft) throw new Error('inserted no version');

    await db.execute(
      sql`UPDATE indicator_version SET update_frequency = 'no-longer-updated' WHERE id = ${draft.id}`,
    );
    await expect(
      db.execute(
        sql`UPDATE indicator_version SET update_frequency = 'Annual' WHERE id = ${draft.id}`,
      ),
    ).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });

  it('allows a draft alongside the published version', async () => {
    const indicatorId = await newIndicatorId();

    await addVersion(indicatorId, 'published');

    await expect(addVersion(indicatorId, 'draft')).resolves.toHaveLength(1);
  });

  it('lets every version of one indicator share a slug', async () => {
    const indicatorId = await newIndicatorId();
    await addVersion(indicatorId, 'published', { slug: 'a-shared-slug' });

    await expect(addVersion(indicatorId, 'draft', { slug: 'a-shared-slug' })).resolves.toHaveLength(
      1,
    );
  });

  it('refuses a slug another indicator already holds, draft or published', async () => {
    const owner = await newIndicatorId();
    const other = await newIndicatorId();
    await addVersion(owner, 'draft', { slug: 'a-claimed-slug' });

    await expect(addVersion(other, 'published', { slug: 'a-claimed-slug' })).rejects.toMatchObject({
      cause: { code: EXCLUSION_VIOLATION },
    });
  });

  it('releases a slug when the draft holding it is deleted', async () => {
    const owner = await newIndicatorId();
    const other = await newIndicatorId();
    const [draft] = await addVersion(owner, 'draft', { slug: 'a-released-slug' });
    await db.delete(indicatorVersion).where(eq(indicatorVersion.id, draft?.id ?? ''));

    await expect(addVersion(other, 'draft', { slug: 'a-released-slug' })).resolves.toHaveLength(1);
  });

  it.each([
    ['digits only, which reads as a short id', '90366'],
    ['in upper case', 'Life-expectancy'],
    ['with a space', 'life expectancy'],
    ['longer than the limit', 'a'.repeat(SLUG_MAX_LENGTH + 1)],
  ])('refuses a slug %s', async (_, slug) => {
    const indicatorId = await newIndicatorId();

    await expect(addVersion(indicatorId, 'draft', { slug })).rejects.toMatchObject({
      cause: { code: CHECK_VIOLATION },
    });
  });

  it('accepts a slug at the length limit', async () => {
    const indicatorId = await newIndicatorId();

    await expect(
      addVersion(indicatorId, 'draft', { slug: 'a'.repeat(SLUG_MAX_LENGTH) }),
    ).resolves.toHaveLength(1);
  });

  // Raw SQL because the insert type only lets a caller name the allowed values.
  it('refuses anyone but OHID, DHSC or other organisations as who calculated it', async () => {
    const indicatorId = await newIndicatorId();
    const [draft] = await addVersion(indicatorId, 'draft');

    await expect(
      db.execute(
        sql`UPDATE indicator_version SET calculated_by = 'nhs' WHERE id = ${draft?.id ?? ''}`,
      ),
    ).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });

  it.each(['ohid', 'dhsc', 'other'] as const)(
    'accepts %s as who calculated it',
    async (calculatedBy) => {
      const indicatorId = await newIndicatorId();

      await expect(addVersion(indicatorId, 'draft', { calculatedBy })).resolves.toHaveLength(1);
    },
  );

  it.each([
    ['nobody', null],
    ['OHID', 'ohid'],
    ['DHSC', 'dhsc'],
  ] as const)('refuses other organisations beside %s', async (_, calculatedBy) => {
    const indicatorId = await newIndicatorId();

    await expect(
      addVersion(indicatorId, 'draft', { calculatedBy, calculatedByOther: 'ONS' }),
    ).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });

  it('accepts other organisations beside "other", named or not yet', async () => {
    await expect(
      addVersion(await newIndicatorId(), 'draft', {
        calculatedBy: 'other',
        calculatedByOther: 'ONS',
      }),
    ).resolves.toHaveLength(1);
    await expect(
      addVersion(await newIndicatorId(), 'draft', { calculatedBy: 'other' }),
    ).resolves.toHaveLength(1);
  });

  // Raw SQL because the insert type no longer lets a caller omit the slug.
  it('refuses a version with no slug', async () => {
    const indicatorId = await newIndicatorId();

    await expect(
      db.execute(
        sql`INSERT INTO indicator_version (indicator_id, name, created_by, updated_by)
            VALUES (${indicatorId}, 'no slug', 'schema-test', 'schema-test')`,
      ),
    ).rejects.toMatchObject({ cause: { code: NOT_NULL_VIOLATION } });
  });
});

describe('ci_method', () => {
  it('takes a method as standard unless told otherwise', async () => {
    const [row] = await db
      .insert(ciMethod)
      .values({ name: 'A method of no particular kind' })
      .returning({ kind: ciMethod.kind });

    expect(row?.kind).toBe('standard');
  });

  it('refuses a kind the publisher form does not know', async () => {
    await expect(
      db.execute(sql`INSERT INTO ci_method (name, kind) VALUES ('A strange method', 'strange')`),
    ).rejects.toMatchObject({ cause: { code: CHECK_VIOLATION } });
  });
});

describe('the published views', () => {
  // A new version column must not change the view, or the views built on it with it.
  it('name the current published version by its id alone', async () => {
    const columns = (await db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'current_published_version'
          ORDER BY ordinal_position`,
    )) as unknown as { column_name: string }[];

    expect(columns.map((row) => row.column_name)).toEqual(['id', 'indicator_id']);
  });

  it('show the most recently published version, memberships and all', async () => {
    const indicatorId = await newIndicatorId();
    const currentTopic = await newTopicId('current-topic');
    const supersededTopic = await newTopicId('superseded-topic');
    const currentClass = await newClassificationId('current-class');
    const supersededClass = await newClassificationId('superseded-class');

    // The newer publication is inserted first, so its UUIDv7 id sorts below the older
    // one's and published_at is the only thing that can pick the right row.
    const [current] = await addVersion(indicatorId, 'published', {
      name: 'Current',
      slug: 'current-name',
      publishedAt: new Date('2026-06-01T00:00:00Z'),
    });
    const [superseded] = await addVersion(indicatorId, 'published', {
      name: 'Superseded',
      slug: 'superseded-name',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });
    if (!current || !superseded) throw new Error('inserted no versions');
    expect(superseded.id > current.id).toBe(true);

    await db.insert(indicatorTopic).values([
      { topicId: currentTopic, indicatorVersionId: current.id },
      { topicId: supersededTopic, indicatorVersionId: superseded.id },
    ]);
    await db.insert(indicatorClassification).values([
      { classificationId: currentClass, indicatorVersionId: current.id },
      { classificationId: supersededClass, indicatorVersionId: superseded.id },
    ]);

    const indicators = (await db.execute(
      sql`SELECT name, slug, first_published_at, last_published_at FROM published.indicator
          WHERE id = ${indicatorId}`,
      // Raw SQL, so the driver hands back timestamps as strings.
    )) as unknown as {
      name: string;
      slug: string;
      first_published_at: string;
      last_published_at: string;
    }[];
    const topics = (await db.execute(
      sql`SELECT topic_id FROM published.indicator_topic WHERE indicator_id = ${indicatorId}`,
    )) as unknown as { topic_id: string }[];
    const classifications = (await db.execute(
      sql`SELECT classification_id FROM published.indicator_classification
          WHERE indicator_id = ${indicatorId}`,
    )) as unknown as { classification_id: string }[];

    expect(indicators).toHaveLength(1);
    expect(indicators[0]?.name).toBe('Current');
    expect(indicators[0]?.slug).toBe('current-name');
    expect(new Date(indicators[0]?.first_published_at ?? '').toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(new Date(indicators[0]?.last_published_at ?? '').toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    );
    expect(topics.map((row) => row.topic_id)).toEqual([currentTopic]);
    expect(classifications.map((row) => row.classification_id)).toEqual([currentClass]);
  });

  it('resolve every slug a published version carries, not only the current one', async () => {
    const indicatorId = await newIndicatorId();
    await addVersion(indicatorId, 'published', {
      slug: 'renamed-indicator',
      publishedAt: new Date('2026-06-01T00:00:00Z'),
    });
    await addVersion(indicatorId, 'published', {
      slug: 'original-indicator',
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });
    await addVersion(indicatorId, 'draft', { slug: 'renamed-indicator' });

    const rows = (await db.execute(
      sql`SELECT slug FROM published.indicator_slug WHERE indicator_id = ${indicatorId}
          ORDER BY slug`,
    )) as unknown as { slug: string }[];

    expect(rows.map((row) => row.slug)).toEqual(['original-indicator', 'renamed-indicator']);
  });

  it('keep who calculated an indicator off the public surface', async () => {
    const rows = (await db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'published' AND column_name LIKE 'calculated_by%'`,
    )) as unknown as { column_name: string }[];

    expect(rows).toEqual([]);
  });

  it('keep the confidence interval follow-up answers and method kinds off the public surface', async () => {
    const rows = (await db.execute(
      sql`SELECT table_name, column_name FROM information_schema.columns
          WHERE table_schema = 'published'
            AND (column_name LIKE 'ci_method_%' OR (table_name = 'ci_method' AND column_name = 'kind'))
          ORDER BY table_name, column_name`,
    )) as unknown as { table_name: string; column_name: string }[];

    expect(rows).toEqual([{ table_name: 'indicator', column_name: 'ci_method_id' }]);
  });

  it('hide a slug only a draft carries', async () => {
    const indicatorId = await newIndicatorId();
    await addVersion(indicatorId, 'draft', { slug: 'an-unpublished-slug' });

    const rows = (await db.execute(
      sql`SELECT slug FROM published.indicator_slug WHERE slug = 'an-unpublished-slug'`,
    )) as unknown as { slug: string }[];

    expect(rows).toEqual([]);
  });
});

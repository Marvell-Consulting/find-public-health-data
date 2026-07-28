import { parseEnv, z } from '@fphd/config';
import { eq, getTableColumns, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.js';
import { dbEnvFields } from './env.js';
import { type TopicRecord, topic } from './schema.js';
import { createTestDatabase, type TestDatabase } from './testing.js';
import { listTopics, upsertTopics } from './topic-repository.js';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
    PUBLIC_API_PASSWORD: z.string().default('public_api'),
    INTERNAL_API_PASSWORD: z.string().default('internal_api'),
  }),
  process.env,
);

function ownerConnection(database: string) {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  };
}

let testDb: TestDatabase;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = createDb(ownerConnection(testDb.name));
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

const topicA: TopicRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'topic-a',
  title: 'Topic A',
  description: 'The first topic.',
};

const topicB: TopicRecord = {
  id: '00000000-0000-4000-8000-000000000002',
  slug: 'topic-b',
  title: 'Topic B',
  description: 'The second topic.',
};

async function requireRow(id: string) {
  const rows = await db
    .select({
      ...getTableColumns(topic),
      // Drizzle maps timestamptz to a millisecond-precision JS Date; the ::text form keeps
      // postgres's microseconds, so timestamp assertions can't alias across a fast run.
      updatedAtText: sql<string>`${topic.updatedAt}::text`,
    })
    .from(topic)
    .where(eq(topic.id, id));
  const row = rows[0];
  if (!row) {
    throw new Error(`No topic row found for id ${id}`);
  }
  return row;
}

describe('topics import (integration)', () => {
  it('inserts every row on a fresh import', async () => {
    const { summary, orphaned } = await upsertTopics(db, [topicA, topicB]);

    expect(summary).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    expect(orphaned).toEqual([]);

    const rows = await db.select().from(topic);
    expect(rows).toHaveLength(2);
  });

  it('is idempotent on a re-run, leaving updated_at untouched', async () => {
    const before = await requireRow(topicA.id);

    const { summary } = await upsertTopics(db, [topicA, topicB]);

    expect(summary).toEqual({ inserted: 0, updated: 0, unchanged: 2 });

    const after = await requireRow(topicA.id);
    expect(after.updatedAtText).toBe(before.updatedAtText);
  });

  it('updates a renamed title in place and bumps updated_at', async () => {
    const before = await requireRow(topicA.id);
    const renamed: TopicRecord = { ...topicA, title: 'Topic A Renamed' };

    const { summary } = await upsertTopics(db, [renamed, topicB]);

    expect(summary).toEqual({ inserted: 0, updated: 1, unchanged: 1 });

    const after = await requireRow(topicA.id);
    expect(after.title).toBe('Topic A Renamed');
    expect(after.updatedAtText).not.toBe(before.updatedAtText);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it('updates a changed slug in place, leaving the primary key unchanged', async () => {
    const resluggedA: TopicRecord = { ...topicA, title: 'Topic A Renamed', slug: 'topic-a-new' };

    const { summary } = await upsertTopics(db, [resluggedA, topicB]);

    expect(summary).toEqual({ inserted: 0, updated: 1, unchanged: 1 });

    const after = await requireRow(topicA.id);
    expect(after.slug).toBe('topic-a-new');

    const rows = await db.select().from(topic);
    expect(rows.map((row) => row.id).sort()).toEqual([topicA.id, topicB.id].sort());
  });

  it('reports a row missing from the file without deleting it', async () => {
    const { orphaned } = await upsertTopics(db, [topicB]);

    expect(orphaned).toEqual([
      {
        id: topicA.id,
        slug: 'topic-a-new',
        title: 'Topic A Renamed',
        description: topicA.description,
      },
    ]);

    // Left in place, not deleted.
    await expect(requireRow(topicA.id)).resolves.toBeDefined();
  });

  const apiRoles = [
    { role: 'public_api', password: env.PUBLIC_API_PASSWORD },
    { role: 'internal_api', password: env.INTERNAL_API_PASSWORD },
  ];

  it.each(apiRoles)('lets $role select topics but not write them', async ({ role, password }) => {
    const client = postgres({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: testDb.name,
      username: role,
      password,
    });

    try {
      await expect(client`SELECT * FROM topic`).resolves.toBeDefined();
      await expect(
        client`INSERT INTO topic (id, slug, title, description) VALUES (gen_random_uuid(), 'x', 'x', 'x')`,
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });
});

describe('listTopics (integration)', () => {
  it('returns topics ordered alphabetically by title', async () => {
    const zebra: TopicRecord = {
      id: '00000000-0000-4000-8000-000000000003',
      slug: 'zebra-topic',
      title: 'Zebra topic',
      description: 'Should sort last.',
    };
    const apple: TopicRecord = {
      id: '00000000-0000-4000-8000-000000000004',
      slug: 'apple-topic',
      title: 'Apple topic',
      description: 'Should sort first.',
    };

    await upsertTopics(db, [zebra, apple]);

    const all = await listTopics(db);
    const titles = all.map((topic) => topic.title);

    expect(titles.indexOf('Apple topic')).toBeLessThan(titles.indexOf('Zebra topic'));

    const zebraRow = all.find((topic) => topic.slug === 'zebra-topic');
    expect(zebraRow).toMatchObject({
      id: zebra.id,
      slug: 'zebra-topic',
      title: 'Zebra topic',
      description: 'Should sort last.',
    });
    expect(zebraRow?.createdAt).toBeInstanceOf(Date);
    expect(zebraRow?.updatedAt).toBeInstanceOf(Date);
  });
});

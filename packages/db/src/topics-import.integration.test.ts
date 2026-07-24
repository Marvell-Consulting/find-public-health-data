import { parseEnv, z } from '@fphd/config';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.js';
import { dbEnvFields } from './env.js';
import { topics, type TopicRecord } from './schema.js';
import { createTestDatabase, type TestDatabase } from './testing.js';
import { importTopics } from './topics-repository.js';

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
  const rows = await db.select().from(topics).where(eq(topics.id, id));
  const row = rows[0];
  if (!row) {
    throw new Error(`No topic row found for id ${id}`);
  }
  return row;
}

describe('topics import (integration)', () => {
  it('inserts every row on a fresh import', async () => {
    const { summary, orphaned } = await importTopics(db, [topicA, topicB]);

    expect(summary).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
    expect(orphaned).toEqual([]);

    const rows = await db.select().from(topics);
    expect(rows).toHaveLength(2);
  });

  it('is idempotent on a re-run, leaving updated_at untouched', async () => {
    const before = await requireRow(topicA.id);

    const { summary } = await importTopics(db, [topicA, topicB]);

    expect(summary).toEqual({ inserted: 0, updated: 0, unchanged: 2 });

    const after = await requireRow(topicA.id);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it('updates a renamed title in place and bumps updated_at', async () => {
    const before = await requireRow(topicA.id);
    const renamed: TopicRecord = { ...topicA, title: 'Topic A Renamed' };

    const { summary } = await importTopics(db, [renamed, topicB]);

    expect(summary).toEqual({ inserted: 0, updated: 1, unchanged: 1 });

    const after = await requireRow(topicA.id);
    expect(after.title).toBe('Topic A Renamed');
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('updates a changed slug in place, leaving the primary key unchanged', async () => {
    const resluggedA: TopicRecord = { ...topicA, title: 'Topic A Renamed', slug: 'topic-a-new' };

    const { summary } = await importTopics(db, [resluggedA, topicB]);

    expect(summary).toEqual({ inserted: 0, updated: 1, unchanged: 1 });

    const after = await requireRow(topicA.id);
    expect(after.slug).toBe('topic-a-new');

    const rows = await db.select().from(topics);
    expect(rows.map((row) => row.id).sort()).toEqual([topicA.id, topicB.id].sort());
  });

  it('reports a row missing from the file without deleting it', async () => {
    const { orphaned } = await importTopics(db, [topicB]);

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
      await expect(client`SELECT * FROM topics`).resolves.toBeDefined();
      await expect(
        client`INSERT INTO topics (id, slug, title, description) VALUES (gen_random_uuid(), 'x', 'x', 'x')`,
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });
});

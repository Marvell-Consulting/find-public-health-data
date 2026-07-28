import { parseEnv, z } from '@fphd/config';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.js';
import { dbEnvFields } from './env.js';
import type { TopicRecord } from './schema.js';
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
  });
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

const zebra: TopicRecord = {
  id: '00000000-0000-7000-8000-000000000003',
  slug: 'zebra-topic',
  title: 'Zebra topic',
  description: 'Should sort last.',
};

const apple: TopicRecord = {
  id: '00000000-0000-7000-8000-000000000004',
  slug: 'apple-topic',
  title: 'Apple topic',
  description: 'Should sort first.',
};

describe('listTopics', () => {
  beforeAll(async () => {
    await upsertTopics(db, [zebra, apple]);
  });

  it('orders topics alphabetically by title', async () => {
    const titles = (await listTopics(db)).map((row) => row.title);

    expect(titles).toEqual(['Apple topic', 'Zebra topic']);
  });

  it('returns the full row, timestamps included', async () => {
    const found = (await listTopics(db)).find((row) => row.slug === 'zebra-topic');

    expect(found).toMatchObject({
      id: zebra.id,
      slug: 'zebra-topic',
      title: 'Zebra topic',
      description: 'Should sort last.',
    });
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });
});

describe('the topic read surface', () => {
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

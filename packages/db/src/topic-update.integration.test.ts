import { appEnvFields, parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createPostgresClient, type Database } from './client.js';
import { dbEnvFields, resolveDbTls } from './env.js';
import type { TopicRecord } from './schema.js';
import { createTestDatabase, type TestDatabase } from './testing.js';
import { getTopicById, updateTopic, upsertTopics } from './topic-repository.js';

// Its own file, and so its own database: these tests write, and the read-side fixtures in
// topic-repository.integration.test.ts assert on the exact contents of the table.
const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
    PUBLIC_API_PASSWORD: z.string().default('public_api'),
    INTERNAL_API_PASSWORD: z.string().default('internal_api'),
  }),
  process.env,
);

let testDb: TestDatabase;
let db: Database;
let topicCount = 0;

const UNKNOWN_ID = '00000000-0000-7000-8000-0000000000ff';

/** A distinct row per test, so no test depends on another having run (or not run) first. */
async function givenTopic(): Promise<TopicRecord> {
  topicCount += 1;
  const reference = topicCount.toString(16);
  const record: TopicRecord = {
    id: `00000000-0000-7000-8000-${reference.padStart(12, '0')}`,
    slug: `topic-${reference}`,
    title: `Topic ${reference}`,
    description: `About topic ${reference}.`,
  };

  await upsertTopics(db, [record]);
  return record;
}

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

describe('updateTopic', () => {
  const editableFields: [string, Partial<TopicRecord>][] = [
    ['title', { title: 'A renamed topic' }],
    ['slug', { slug: 'a-renamed-topic' }],
    ['description', { description: 'A rewritten description.' }],
  ];

  it.each(editableFields)('writes a changed %s and bumps updatedAt', async (_field, change) => {
    const topic = await givenTopic();
    const before = await getTopicById(db, topic.id);

    const result = await updateTopic(db, topic.id, { ...topic, ...change });

    expect(result).toMatchObject({ ok: true, changed: true, topic: change });

    const after = await getTopicById(db, topic.id);
    expect(after).toMatchObject(change);
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0);
  });

  it('reports an identical submission as unchanged and leaves updatedAt alone', async () => {
    const topic = await givenTopic();
    const before = await getTopicById(db, topic.id);

    const result = await updateTopic(db, topic.id, topic);

    expect(result).toMatchObject({ ok: true, changed: false });
    expect((await getTopicById(db, topic.id))?.updatedAt).toEqual(before?.updatedAt);
  });

  it('reports an unknown id rather than throwing', async () => {
    expect(await updateTopic(db, UNKNOWN_ID, { slug: 's', title: 't', description: 'd' })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('reports a slug already held by another topic, leaving both rows as they were', async () => {
    const target = await givenTopic();
    const other = await givenTopic();

    const result = await updateTopic(db, target.id, { ...target, slug: other.slug });

    expect(result).toEqual({ ok: false, reason: 'slug_taken' });
    expect(await getTopicById(db, target.id)).toMatchObject(target);
    expect(await getTopicById(db, other.id)).toMatchObject(other);
  });
});

describe('the topic write surface', () => {
  function connectAs(role: string, password: string) {
    return createPostgresClient({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: testDb.name,
      user: role,
      password,
      ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
    });
  }

  it('lets internal_api update the editable columns', async () => {
    const topic = await givenTopic();
    const client = connectAs('internal_api', env.INTERNAL_API_PASSWORD);

    try {
      await expect(
        client`UPDATE topic SET title = 'Edited by the API' WHERE id = ${topic.id}`,
      ).resolves.toBeDefined();
    } finally {
      await client.end();
    }
  });

  it('does not let internal_api rewrite the key or the creation timestamp', async () => {
    const topic = await givenTopic();
    const client = connectAs('internal_api', env.INTERNAL_API_PASSWORD);

    try {
      await expect(
        client`UPDATE topic SET created_at = now() WHERE id = ${topic.id}`,
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });

  it('does not let public_api update topics at all', async () => {
    const topic = await givenTopic();
    const client = connectAs('public_api', env.PUBLIC_API_PASSWORD);

    try {
      await expect(client`UPDATE topic SET title = 'Nope' WHERE id = ${topic.id}`).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await client.end();
    }
  });
});

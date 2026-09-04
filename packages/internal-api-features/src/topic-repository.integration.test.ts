import { appEnvFields, parseEnv, z } from '@fphd/config';
import {
  createDb,
  createPostgresClient,
  type Database,
  dbEnvFields,
  resolveDbTls,
  schema,
} from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTopic, deleteTopic, getTopicById, updateTopic } from './topic-repository.js';

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
async function givenTopic() {
  topicCount += 1;
  const reference = topicCount.toString(16);
  const record = {
    id: `00000000-0000-7000-8000-${reference.padStart(12, '0')}`,
    slug: `topic-${reference}`,
    title: `Topic ${reference}`,
    description: `About topic ${reference}.`,
  };

  await db.insert(schema.topic).values(record);
  return record;
}

function connectionTo(user: string, password: string) {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user,
    password,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  };
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = createDb(connectionTo(env.POSTGRES_USER, env.POSTGRES_PASSWORD));
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

describe('getTopicById', () => {
  it('returns the topic matching the given id', async () => {
    const topic = await givenTopic();

    expect(await getTopicById(db, topic.id)).toMatchObject(topic);
  });

  it('returns undefined for an unknown id', async () => {
    expect(await getTopicById(db, UNKNOWN_ID)).toBeUndefined();
  });
});

describe('updateTopic', () => {
  const editableFields: [string, Partial<Awaited<ReturnType<typeof givenTopic>>>][] = [
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
    expect(after?.id).toBe(topic.id);
    expect(after?.createdAt).toEqual(before?.createdAt);
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

describe('createTopic', () => {
  it('inserts a topic, letting the database mint the id and both timestamps', async () => {
    const result = await createTopic(db, {
      slug: 'a-new-topic',
      title: 'A new topic',
      description: 'Freshly created.',
    });

    expect(result).toMatchObject({
      ok: true,
      topic: { slug: 'a-new-topic', title: 'A new topic' },
    });

    if (result.ok) {
      expect(result.topic.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.topic.createdAt).toBeInstanceOf(Date);
      expect(await getTopicById(db, result.topic.id)).toMatchObject({ slug: 'a-new-topic' });
    }
  });

  it('reports a slug already held by another topic rather than throwing', async () => {
    const existing = await givenTopic();

    const result = await createTopic(db, {
      slug: existing.slug,
      title: 'Different title',
      description: 'Different description.',
    });

    expect(result).toEqual({ ok: false, reason: 'slug_taken' });
  });
});

describe('deleteTopic', () => {
  it('deletes a topic and reports success', async () => {
    const topic = await givenTopic();

    expect(await deleteTopic(db, topic.id)).toEqual({ ok: true });
    expect(await getTopicById(db, topic.id)).toBeUndefined();
  });

  it('reports an unknown id rather than throwing', async () => {
    expect(await deleteTopic(db, UNKNOWN_ID)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('the topic write surface', () => {
  it('lets internal_api update the editable columns', async () => {
    const topic = await givenTopic();
    const client = createPostgresClient(connectionTo('internal_api', env.INTERNAL_API_PASSWORD));

    try {
      await expect(
        client`UPDATE topic SET title = 'Edited by the API' WHERE id = ${topic.id}`,
      ).resolves.toBeDefined();
    } finally {
      await client.end();
    }
  });

  it('lets internal_api insert and delete a topic', async () => {
    const client = createPostgresClient(connectionTo('internal_api', env.INTERNAL_API_PASSWORD));

    try {
      await expect(
        client`INSERT INTO topic (slug, title, description) VALUES ('granted-insert', 'Granted insert', 'x')`,
      ).resolves.toBeDefined();
      await expect(client`DELETE FROM topic WHERE slug = 'granted-insert'`).resolves.toBeDefined();
    } finally {
      await client.end();
    }
  });

  // Connected as internal_api rather than the owner, which can write anything whatever the
  // statement names: this is what proves the app's own write path works under the grants.
  it('creates and deletes through the repository connected as internal_api', async () => {
    const apiDb = createDb(connectionTo('internal_api', env.INTERNAL_API_PASSWORD));

    try {
      const created = await createTopic(apiDb, {
        slug: 'internal-api-create',
        title: 'Internal API create',
        description: 'Created by the API role.',
      });

      expect(created).toMatchObject({ ok: true, topic: { slug: 'internal-api-create' } });

      if (created.ok) {
        expect(created.topic.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(created.topic.createdAt).toBeInstanceOf(Date);
        expect(await deleteTopic(apiDb, created.topic.id)).toEqual({ ok: true });
      }
    } finally {
      await apiDb.$client.end();
    }
  });

  it('does not let public_api update, insert or delete topics at all', async () => {
    const topic = await givenTopic();
    const client = createPostgresClient(connectionTo('public_api', env.PUBLIC_API_PASSWORD));

    try {
      await expect(client`UPDATE topic SET title = 'Nope' WHERE id = ${topic.id}`).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        client`INSERT INTO topic (slug, title, description) VALUES ('nope', 'Nope', 'x')`,
      ).rejects.toThrow(/permission denied/);
      await expect(client`DELETE FROM topic WHERE id = ${topic.id}`).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await client.end();
    }
  });
});

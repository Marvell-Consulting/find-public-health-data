import { appEnvFields, parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.js';
import { dbEnvFields, resolveDbTls } from './env.js';
import { createTestDatabase, type TestDatabase } from './testing.js';
import { deleteTopic, getTopicById } from './topic-repository.js';

// Seeded, because the cascade is only meaningful against real indicator_topic links, and
// building an indicator by hand would mean seeding the whole lookup graph it references.
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
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

describe('deleteTopic with linked indicators', () => {
  it('removes the topic and its links, but leaves the indicators themselves', async () => {
    const [linked] = await db.$client<{ topicId: string }[]>`
      SELECT topic_id AS "topicId" FROM indicator_topic GROUP BY topic_id LIMIT 1
    `;
    if (linked === undefined) throw new Error('the seed has no indicator_topic links to exercise');

    const links = await db.$client<{ indicatorId: string }[]>`
      SELECT indicator_id AS "indicatorId" FROM indicator_topic WHERE topic_id = ${linked.topicId}
    `;
    expect(links.length).toBeGreaterThan(0);

    const result = await deleteTopic(db, linked.topicId);

    expect(result).toEqual({ ok: true });
    expect(await getTopicById(db, linked.topicId)).toBeUndefined();

    const [remaining] = await db.$client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM indicator_topic WHERE topic_id = ${linked.topicId}
    `;
    expect(remaining?.count).toBe(0);

    const [survivors] = await db.$client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM indicator
      WHERE id IN ${db.$client(links.map((link) => link.indicatorId))}
    `;
    expect(survivors?.count).toBe(links.length);
  });
});

import { appEnvFields, parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.js';
import { dbEnvFields, resolveDbTls } from './env.js';
import { indicator } from './schema/index.js';
import { createTestDatabase, type TestDatabase } from './testing.js';

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

describe('a stub indicator', () => {
  it('needs only a name, and the database mints the rest', async () => {
    const [row] = await db
      .insert(indicator)
      .values({ name: 'A stub with nothing but a name' })
      .returning();

    expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.shortId).toBeGreaterThanOrEqual(FIRST_MINTED_SHORT_ID);
    expect(row?.status).toBe('draft');
    expect(row?.valueTypeId).toBeNull();
    expect(row?.createdBy).toBeNull();
  });

  it('takes its short id from the sequence, so the next one differs', async () => {
    const [first] = await db.insert(indicator).values({ name: 'First' }).returning();
    const [second] = await db.insert(indicator).values({ name: 'Second' }).returning();

    expect(second?.shortId).toBe((first?.shortId ?? 0) + 1);
  });
});

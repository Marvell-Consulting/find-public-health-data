import { appEnvFields, parseEnv, z } from '@fphd/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Database } from './client.ts';
import { dbEnvFields, resolveDbTls } from './env.ts';
import { indicator, indicatorVersion } from './schema/index.ts';
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

async function addVersion(indicatorId: string, status: 'draft' | 'published') {
  return db
    .insert(indicatorVersion)
    .values({ indicatorId, status, createdBy: 'schema-test', updatedBy: 'schema-test' })
    .returning();
}

describe('a stub indicator', () => {
  it('needs nothing but an actor on its first draft', async () => {
    const indicatorId = await newIndicatorId();

    const [version] = await addVersion(indicatorId, 'draft');

    expect(indicatorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(version?.status).toBe('draft');
    expect(version?.name).toBeNull();
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

  it('allows one published version per indicator', async () => {
    const indicatorId = await newIndicatorId();
    await addVersion(indicatorId, 'published');

    await expect(addVersion(indicatorId, 'published')).rejects.toMatchObject({
      cause: { code: UNIQUE_VIOLATION },
    });
  });

  it('allows a draft alongside the published version', async () => {
    const indicatorId = await newIndicatorId();

    await addVersion(indicatorId, 'published');

    await expect(addVersion(indicatorId, 'draft')).resolves.toHaveLength(1);
  });
});

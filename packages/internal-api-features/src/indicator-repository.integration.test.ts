import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { asc, desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listIndicatorsPage } from './indicator-repository.js';

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
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

const { indicator } = schema;

async function seededIdsNewestFirst(): Promise<string[]> {
  const rows = await db
    .select({ id: indicator.id })
    .from(indicator)
    .orderBy(desc(indicator.updatedAt), asc(indicator.name), asc(indicator.id));

  return rows.map((row) => row.id);
}

describe('listIndicatorsPage', () => {
  it('pages through every indicator, most recently edited first', async () => {
    const expected = await seededIdsNewestFirst();
    const pageSize = Math.ceil(expected.length / 2);

    const first = await listIndicatorsPage(db, 1, pageSize);
    const second = await listIndicatorsPage(db, 2, pageSize);

    expect(first.total).toBe(expected.length);
    expect(second.total).toBe(expected.length);
    expect([...first.indicators, ...second.indicators].map((row) => row.id)).toEqual(expected);
  });

  it('returns an empty page past the end, still reporting the total', async () => {
    const expected = await seededIdsNewestFirst();

    const page = await listIndicatorsPage(db, 2, expected.length);

    expect(page.indicators).toEqual([]);
    expect(page.total).toBe(expected.length);
  });

  it('includes indicators the public listing would hide', async () => {
    const [target] = await seededIdsNewestFirst();
    if (target === undefined) throw new Error('The seed holds no indicators');

    await db.update(indicator).set({ status: 'draft' }).where(eq(indicator.id, target));

    const page = await listIndicatorsPage(db, 1, 1);

    expect(page.indicators[0]?.id).toBe(target);
  });
});

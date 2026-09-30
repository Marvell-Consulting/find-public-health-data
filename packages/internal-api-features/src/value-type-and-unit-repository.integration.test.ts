import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listValueTypeAndUnitOptions } from './value-type-and-unit-repository.ts';

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
  testDb = await createTestDatabase();
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });
  // Each list in reverse order of id, which no order by name or id would give.
  for (const table of ['value_type', 'unit']) {
    await db.execute(sql`
      UPDATE ${sql.identifier(table)} t SET position = r.position
      FROM (
        SELECT id, (row_number() OVER (ORDER BY id DESC))::smallint AS position
        FROM ${sql.identifier(table)}
      ) r
      WHERE r.id = t.id
    `);
  }
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

describe('listValueTypeAndUnitOptions', () => {
  it('lists every value type and unit by position, as the form does', async () => {
    const { valueTypes, units } = await listValueTypeAndUnitOptions(db);
    const ids = (options: { id: string }[]) => options.map(({ id }) => id);
    const descending = (values: string[]) => [...values].sort().reverse();

    expect(valueTypes.length).toBeGreaterThan(1);
    expect(ids(valueTypes)).toEqual(descending(ids(valueTypes)));
    expect(ids(units)).toEqual(descending(ids(units)));
  });
});

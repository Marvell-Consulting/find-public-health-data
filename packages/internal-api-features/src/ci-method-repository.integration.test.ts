import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getCiMethodById, listCiMethods } from './ci-method-repository.ts';

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
  await db
    .insert(schema.ciMethod)
    .values([
      { name: 'Wilson Score method', description: 'A description.' },
      { name: 'Other method', kind: 'other' },
      { name: "Byar's method (adjusted for repeat hospital admissions)" },
      { name: "Byar's method" },
    ]);
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

describe('listCiMethods', () => {
  it('lists every method by name, with its description and kind', async () => {
    const methods = await listCiMethods(db);

    expect(methods.map(({ name, description, kind }) => ({ name, description, kind }))).toEqual([
      { name: "Byar's method", description: null, kind: 'standard' },
      {
        name: "Byar's method (adjusted for repeat hospital admissions)",
        description: null,
        kind: 'standard',
      },
      { name: 'Other method', description: null, kind: 'other' },
      { name: 'Wilson Score method', description: 'A description.', kind: 'standard' },
    ]);
  });
});

describe('getCiMethodById', () => {
  it('finds a method by its id', async () => {
    const [first] = await listCiMethods(db);
    if (!first) throw new Error('inserted no methods');

    await expect(getCiMethodById(db, first.id)).resolves.toEqual(first);
  });

  it('finds nothing for an id no method has', async () => {
    await expect(
      getCiMethodById(db, '00000000-0000-7000-8000-000000000000'),
    ).resolves.toBeUndefined();
  });
});

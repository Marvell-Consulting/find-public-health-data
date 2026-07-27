import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

// config.ts parses the environment at import, so the repo .env must load first and
// POSTGRES_DB must point at this file's own database before db.js is imported.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const { createTestDatabase } = await import('@fphd/db/testing');
const testDb = await createTestDatabase();
process.env.POSTGRES_DB = testDb.name;

const { db } = await import('./db.js');
const { schema } = await import('@fphd/db');

afterAll(async () => {
  await testDb.drop();
});

describe('internal API database connection', () => {
  it('reads the seeded schema as the internal_api role', async () => {
    const indicators = await db.select({ id: schema.indicator.id }).from(schema.indicator);
    expect(indicators).toHaveLength(10);
  });

  it('connects with a read-only role', async () => {
    await expect(
      db.insert(schema.valueType).values({ name: 'integration-test-denied' }),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('can read operational upload data, unlike the public role', async () => {
    const batches = await db.select({ id: schema.uploadBatch.id }).from(schema.uploadBatch);
    expect(batches).toHaveLength(10);
  });
});

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// config.ts parses the environment at import, so the repo .env must load first;
// values already present in the environment win.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const { db } = await import('./db.js');
const { schema } = await import('@fphd/db');

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
});

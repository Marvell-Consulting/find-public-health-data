import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

// config.ts parses the environment at import, so the repo .env must load first;
// values already present in the environment win.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const { db } = await import('./db.js');
const { createApp } = await import('./app.js');
const { schema } = await import('@fphd/db');

describe('public API against the seeded database', () => {
  it('lists the seeded indicators', async () => {
    const response = await request(createApp({ db })).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(10);
    expect(response.body.indicators[0]).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      status: 'approved',
    });
    const names = response.body.indicators.map((i: { name: string }) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('connects with a read-only role', async () => {
    await expect(
      db.insert(schema.valueType).values({ name: 'integration-test-denied' }),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });
});

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

// config.ts parses the environment at import, so the repo .env must load first;
// values already present in the environment win.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const { db } = await import('./db.js');
const { createApp } = await import('./app.js');
const { createOwnerClient, schema } = await import('@fphd/db');

const owner = createOwnerClient();
afterAll(() => owner.end());

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

  it('does not list indicators that are not approved', async () => {
    const inserted = await owner`
      INSERT INTO indicator
        (name, value_type_id, unit_id, year_type_id, polarity_id, frequency_id,
         status, created_by, updated_by)
      SELECT 'integration-test draft indicator', vt.id, u.id, yt.id, p.id, f.id,
             'draft', 'integration-test', 'integration-test'
      FROM value_type vt, unit u, year_type yt, polarity p, frequency f
      LIMIT 1
      RETURNING id
    `;
    try {
      const response = await request(createApp({ db })).get('/api/indicators');
      expect(response.status).toBe(200);
      expect(response.body.indicators).toHaveLength(10);
      const ids = response.body.indicators.map((i: { id: number }) => i.id);
      expect(ids).not.toContain(inserted[0]?.id);
    } finally {
      await owner`DELETE FROM indicator WHERE id = ${inserted[0]?.id}`;
    }
  });

  it('connects with a read-only role', async () => {
    await expect(
      db.insert(schema.valueType).values({ name: 'integration-test-denied' }),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('cannot read operational upload data', async () => {
    await expect(
      db.select({ id: schema.uploadBatch.id }).from(schema.uploadBatch),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });
});

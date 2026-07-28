import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

// config.ts parses the environment at import, so the repo .env must load first and
// POSTGRES_DB must point at this file's own database before db.js is imported.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const { createTestDatabase } = await import('@fphd/db/testing');
const testDb = await createTestDatabase({ template: 'seeded' });
process.env.POSTGRES_DB = testDb.name;

const { db } = await import('./db.js');
const { createApp } = await import('./app.js');
const { createOwnerClient, createRepositories, schema } = await import('@fphd/db');

const owner = createOwnerClient(testDb.name);
const repositories = createRepositories(db);

afterAll(async () => {
  await owner.end();
  await testDb.drop();
});

describe('public API against the seeded database', () => {
  it('lists the seeded indicators', async () => {
    const response = await request(createApp({ repositories })).get('/api/indicators');

    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(10);
    expect(response.body.indicators[0]).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      fingertipsId: expect.any(Number),
      name: expect.any(String),
      status: 'approved',
    });
    const names = response.body.indicators.map((i: { name: string }) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('does not list indicators that are not approved', async () => {
    const inserted = await owner`
      INSERT INTO indicator
        (fingertips_id, name, value_type_id, unit_id, year_type_id, polarity_id, frequency_id,
         status, created_by, updated_by)
      SELECT 999999, 'integration-test draft indicator', vt.id, u.id, yt.id, p.id, f.id,
             'draft', 'integration-test', 'integration-test'
      FROM value_type vt, unit u, year_type yt, polarity p, frequency f
      LIMIT 1
      RETURNING id
    `;
    const response = await request(createApp({ repositories })).get('/api/indicators');
    expect(response.status).toBe(200);
    expect(response.body.indicators).toHaveLength(10);
    const ids = response.body.indicators.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(inserted[0]?.id);
  });

  it('returns the full detail for a seeded indicator, matching the wire contract', async () => {
    const { indicatorDetailSchema } = await import('@fphd/public-api-features/contract');

    const response = await request(createApp({ repositories })).get('/api/indicators/108');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      fingertipsId: 108,
      name: expect.stringContaining('Under 75 mortality rate'),
      valueType: expect.any(String),
      unit: { name: expect.any(String), label: expect.any(String) },
      definition: expect.any(String),
    });
    expect(response.body.areaTypes.length).toBeGreaterThan(0);
    expect(response.body.areaTypes[0]).toEqual({
      name: expect.any(String),
      areaCount: expect.any(Number),
    });
    expect(response.body).not.toHaveProperty('id');
    expect(() => indicatorDetailSchema.parse(response.body)).not.toThrow();
  });

  it('returns 404 for a fingertips id with no indicator', async () => {
    const response = await request(createApp({ repositories })).get('/api/indicators/424242');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not_found' });
  });

  it('does not serve an indicator that is not approved', async () => {
    await owner`
      INSERT INTO indicator
        (fingertips_id, name, value_type_id, unit_id, year_type_id, polarity_id, frequency_id,
         status, created_by, updated_by)
      SELECT 999998, 'integration-test archived indicator', vt.id, u.id, yt.id, p.id, f.id,
             'archived', 'integration-test', 'integration-test'
      FROM value_type vt, unit u, year_type yt, polarity p, frequency f
      LIMIT 1
    `;

    const response = await request(createApp({ repositories })).get('/api/indicators/999998');

    expect(response.status).toBe(404);
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

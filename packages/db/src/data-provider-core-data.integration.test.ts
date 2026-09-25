import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDbFromClient } from './client.ts';
import { importCoreData } from './core-data.ts';
import { type DataProviderRecord, upsertDataProviders } from './data-provider-core-data.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { loadIndicatorVersions } from './seeding.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

describe('the committed core data and seed', () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    testDb = await createTestDatabase({ template: 'seeded' });
    sql = createOwnerClient(testDb.name);
  });

  afterAll(async () => {
    await sql.end();
    await testDb.drop();
  });

  it('give each seeded version the providers and sources its Fingertips sources map to', async () => {
    const rows = await sql<{ part: string; provider: string; source: string | null }[]>`
      SELECT s.part, p.name AS provider, ps.name AS source
      FROM indicator_version_source s
      JOIN indicator_version v ON v.id = s.indicator_version_id
      JOIN indicator i ON i.id = v.indicator_id
      JOIN data_provider p ON p.id = s.provider_id
      LEFT JOIN data_provider_source ps ON ps.id = s.source_id
      WHERE i.short_id = 94194
      ORDER BY s.part DESC, s.position
    `;

    // Fingertips names one source, "Hospital Episode Statistics (HES), Admitted Patient Care (APC)".
    expect(rows).toEqual([
      {
        part: 'numerator',
        provider: 'NHS England (NHSE)',
        source: 'Hospital Episode Statistics (HES)',
      },
      { part: 'numerator', provider: 'NHS England (NHSE)', source: 'Admitted Patient Care (APC)' },
      {
        part: 'denominator',
        provider: 'Office for National Statistics (ONS)',
        source: 'Mid-year population estimates',
      },
    ]);
  });

  it('give a count no denominator where Fingertips says it has none', async () => {
    const rows = await sql<{ part: string }[]>`
      SELECT s.part FROM indicator_version_source s
      JOIN indicator_version v ON v.id = s.indicator_version_id
      JOIN indicator i ON i.id = v.indicator_id
      WHERE i.short_id = 92708
    `;

    expect(rows).toEqual([{ part: 'numerator' }]);
  });
});

describe('upsertDataProviders', () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  const provider: DataProviderRecord = {
    id: '01a0d858-9885-764e-8d53-6826aec67001',
    name: 'Office for National Statistics (ONS)',
    sources: [{ id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Live births' }],
  };

  beforeAll(async () => {
    testDb = await createTestDatabase();
    sql = createOwnerClient(testDb.name);
  });

  afterAll(async () => {
    await sql.end();
    await testDb.drop();
  });

  it('inserts, leaves an unchanged row alone, rewrites a changed one and reports strays', async () => {
    const db = createDbFromClient(sql);
    const [stray] = await sql<{ id: string }[]>`
      INSERT INTO data_provider (name) VALUES ('A provider no file lists') RETURNING id
    `;

    const first = await upsertDataProviders(db, [provider]);
    const again = await upsertDataProviders(db, [provider]);
    const renamed = await upsertDataProviders(db, [
      { ...provider, sources: [{ id: '01a0d858-9885-764e-8d53-6826aec67002', name: 'Births' }] },
    ]);

    expect(first).toMatchObject({
      providers: { inserted: 1, updated: 0, unchanged: 0 },
      sources: { inserted: 1, updated: 0, unchanged: 0 },
    });
    expect(again).toMatchObject({
      providers: { inserted: 0, updated: 0, unchanged: 1 },
      sources: { inserted: 0, updated: 0, unchanged: 1 },
    });
    expect(renamed).toMatchObject({
      providers: { inserted: 0, updated: 0, unchanged: 1 },
      sources: { inserted: 0, updated: 1, unchanged: 0 },
    });
    expect(renamed.orphaned).toEqual([{ id: stray?.id, name: 'A provider no file lists' }]);
  });
});

describe('loadIndicatorVersions with Fingertips sources', () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;
  let directory: string;
  let indicatorId: string;

  const legacyId = '00000000-0000-7000-8000-00000000abcd';

  beforeAll(async () => {
    testDb = await createTestDatabase();
    sql = createOwnerClient(testDb.name);
    await importCoreData(sql);
    const [row] = await sql<{ id: string }[]>`INSERT INTO indicator DEFAULT VALUES RETURNING id`;
    indicatorId = row?.id ?? '';
    directory = await mkdtemp(join(tmpdir(), 'fphd-legacy-sources-'));
    await writeFile(
      join(directory, 'ci_method.csv.gz'),
      gzipSync('id,name,description\n00000000-0000-7000-8000-00000000c1c1,Unknown,\n'),
    );
    await writeFile(
      join(directory, 'indicator_version.csv.gz'),
      gzipSync(
        'indicator_id,status,published_at,name,slug,numerator_source_id,denominator_source_id,created_by,updated_by\n' +
          `${indicatorId},published,2026-01-01T00:00:00Z,A seeded indicator,a-seeded-indicator,${legacyId},,seed,seed\n`,
      ),
    );
  });

  afterAll(async () => {
    await sql.end();
    await testDb.drop();
    await rm(directory, { recursive: true, force: true });
  });

  async function writeLegacySource(name: string) {
    await writeFile(
      join(directory, 'numerator_denominator_source.csv.gz'),
      gzipSync(`id,name,url\n${legacyId},"${name}",\n`),
    );
  }

  it('gives a version the providers and sources its Fingertips source maps to, in order', async () => {
    await writeLegacySource(
      'Office for National Statistics (ONS), Mid-year population estimates and Office for National Statistics (ONS), Annual Population Survey (APS)',
    );

    const loaded = await sql.begin((tx) => loadIndicatorVersions(tx, directory));
    const rows = await sql<{ part: string; source: string | null }[]>`
      SELECT s.part, ps.name AS source FROM indicator_version_source s
      JOIN indicator_version v ON v.id = s.indicator_version_id
      LEFT JOIN data_provider_source ps ON ps.id = s.source_id
      WHERE v.indicator_id = ${indicatorId}
      ORDER BY s.position
    `;

    expect(loaded).toEqual({ ciMethods: 1, versions: 1, legacySources: 1, sources: 2 });
    expect(rows).toEqual([
      { part: 'numerator', source: 'Mid-year population estimates' },
      { part: 'numerator', source: 'Annual Population Survey (APS)' },
    ]);
    await sql`DELETE FROM indicator_version_source`;
    await sql`DELETE FROM indicator_version WHERE indicator_id = ${indicatorId}`;
  });

  it('stops the load at a source the map does not name', async () => {
    await writeLegacySource('A source nobody has mapped');

    await expect(sql.begin((tx) => loadIndicatorVersions(tx, directory))).rejects.toThrow(
      /No mapping for the sources A source nobody has mapped/,
    );
  });

  it('stops the load at a pair the core data does not hold', async () => {
    await writeLegacySource('Mapped elsewhere');
    const map = { 'Mapped elsewhere': [{ provider: 'A provider nobody lists', source: null }] };

    await expect(
      sql.begin((tx) => loadIndicatorVersions(tx, directory, undefined, undefined, map)),
    ).rejects.toThrow(/names A provider nobody lists, which the core data does not hold/);
  });
});

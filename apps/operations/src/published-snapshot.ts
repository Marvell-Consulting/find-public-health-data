import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

import { z } from '@fphd/config';
import { readCsvHeader, SEED_TABLES } from '@fphd/db/operations';

const runFile = promisify(execFile);
const publishedSource = 'PHOLIO_LIVE_A-derived fphd_new benchmark clone';
const publishedCsvNull = '__FPHD_NULL_5f92c66de4b849b4a717c23f5cbdb8a1__';
// These independently recorded benchmark counts reject accidental source mix-ups.
// The benchmark setup establishes lineage; these counts are not a provenance signature.
const expectedApprovedIndicators = 1_290;
const expectedObservations = 29_380_899;
// The approved indicators the export leaves out, each the retired half of a pair sharing a
// name and so a slug. The export holds the same list; an archive built with another is refused.
const excludedIndicators = [90_366, 90_776, 92_774, 93_280];
const expectedExportedIndicators = expectedApprovedIndicators - excludedIndicators.length;

const sourceManifestSchema = z.object({
  source: z.literal(publishedSource),
  source_database: z.literal('fphd_new'),
  approved_indicators: z.literal(expectedApprovedIndicators),
  // The source's count before exclusion: the fingerprint of the clone the archive came from.
  source_observations: z.literal(expectedObservations),
  excluded_indicators: z.array(z.number().int()),
  excluded_observations: z.number().int().nonnegative(),
  source_csv_null: z.literal(publishedCsvNull),
  tables: z.record(
    z.string(),
    z.object({
      rows: z.number().int().nonnegative(),
      bytes: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
});
const manifestSchema = sourceManifestSchema.extend({
  id_mapping: z.literal('deterministic-uuidv7-v1'),
});

export type PublishedManifest = z.infer<typeof manifestSchema>;

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyPublishedSnapshot(directory: string): Promise<PublishedManifest> {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
  );
  const sourceManifest = sourceManifestSchema.parse(
    JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8')),
  );
  const actualTables = Object.keys(manifest.tables).sort();
  const expectedTables = [...SEED_TABLES].sort().join(',');
  if (
    actualTables.join(',') !== expectedTables ||
    Object.keys(sourceManifest.tables).sort().join(',') !== expectedTables
  ) {
    throw new Error('Published snapshot table list does not match the seed schema');
  }
  if (sourceManifest.excluded_indicators.join(',') !== excludedIndicators.join(',')) {
    throw new Error('Published snapshot was exported with a different exclusion list');
  }
  if (
    manifest.tables.indicator?.rows !== expectedExportedIndicators ||
    // The export turns each exported source indicator into one published version.
    manifest.tables.indicator_version?.rows !== expectedExportedIndicators ||
    // The excluded indicators' observations go with them, and the export says how many.
    manifest.tables.observation?.rows !==
      expectedObservations - sourceManifest.excluded_observations
  ) {
    throw new Error('Published snapshot row counts do not match the published benchmark clone');
  }
  for (const table of SEED_TABLES) {
    const expected = manifest.tables[table];
    if (!expected || expected.rows === 0)
      throw new Error(`Published snapshot has no ${table} rows`);
    if (expected.rows !== sourceManifest.tables[table]?.rows) {
      throw new Error(`Published snapshot source row count differs for ${table}`);
    }
    const file = join(directory, `${table}.csv.gz`);
    if ((await sha256(file)) !== expected.sha256) {
      throw new Error(`Published snapshot checksum failed for ${table}`);
    }
  }
  // The seed COPY takes its column list from each file, so an archive exported before a
  // column existed would only fail deep inside the import. Name the gap here instead.
  const versionColumns = await readCsvHeader(join(directory, 'indicator_version.csv.gz'));
  if (!versionColumns.includes('slug')) {
    throw new Error('Published snapshot indicator_version.csv.gz carries no slug column');
  }
  return manifest;
}

export async function downloadPublishedSnapshot(
  url: string,
  expectedSha256: string,
): Promise<{ directory: string; manifest: PublishedManifest; cleanup: () => Promise<void> }> {
  if (new URL(url).protocol !== 'https:') throw new Error('Published snapshot URL must use HTTPS');
  const directory = await mkdtemp(join(tmpdir(), 'fphd-published-'));
  try {
    const archive = join(directory, 'snapshot.tar');
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Published snapshot download returned HTTP ${response.status}`);
    }
    await pipeline(response.body, createWriteStream(archive));
    if ((await sha256(archive)) !== expectedSha256) {
      throw new Error('Published snapshot archive checksum failed');
    }

    const { stdout } = await runFile('tar', ['-tf', archive]);
    const expectedFiles = new Set([
      'manifest.json',
      'source-manifest.json',
      ...SEED_TABLES.map((table) => `${table}.csv.gz`),
    ]);
    const archivedFiles = stdout.trim().split('\n');
    if (
      archivedFiles.length !== expectedFiles.size ||
      archivedFiles.some((file) => !expectedFiles.has(file))
    ) {
      throw new Error('Published snapshot archive contains unexpected files');
    }
    await runFile('tar', ['-xf', archive, '-C', directory]);
    const manifest = await verifyPublishedSnapshot(directory);
    return { directory, manifest, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

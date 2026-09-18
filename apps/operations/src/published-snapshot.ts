import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';

import { z } from '@fphd/config';
import { SEED_TABLES } from '@fphd/db/operations';

const runFile = promisify(execFile);
const publishedSource = 'PHOLIO_LIVE_A-derived fphd_new benchmark clone';

const manifestSchema = z.object({
  source: z.literal(publishedSource),
  source_database: z.literal('fphd_new'),
  approved_indicators: z.number().int().positive(),
  id_mapping: z.literal('deterministic-uuidv7-v1'),
  tables: z.record(
    z.string(),
    z.object({
      rows: z.number().int().nonnegative(),
      bytes: z.number().int().positive(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  ),
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
  const actualTables = Object.keys(manifest.tables).sort();
  if (actualTables.join(',') !== [...SEED_TABLES].sort().join(',')) {
    throw new Error('Published snapshot table list does not match the seed schema');
  }
  if (manifest.tables.indicator?.rows !== manifest.approved_indicators) {
    throw new Error('Published snapshot indicator count does not match its approval count');
  }
  for (const table of SEED_TABLES) {
    const expected = manifest.tables[table];
    if (!expected || expected.rows === 0)
      throw new Error(`Published snapshot has no ${table} rows`);
    const file = join(directory, `${table}.csv.gz`);
    if ((await sha256(file)) !== expected.sha256) {
      throw new Error(`Published snapshot checksum failed for ${table}`);
    }
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

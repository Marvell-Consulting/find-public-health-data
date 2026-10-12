import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { DATA_MIGRATION_NULL, SEED_TABLES } from '@fphd/db/data-migration-contract';

import { exportPholio } from './pholio/export-pholio.ts';
import { rekeyDirectory } from './prepare-baseline.ts';

const runFile = promisify(execFile);

const devSource = 'PHOLIO_LIVE_B export';
const devDatabase = 'pholio_live_b';
// Counts omit test indicator 94204 and precede the four explicit exclusions.
const expectedApprovedIndicators = 1_329;
const expectedObservations = 29_656_329;
// Each is the retired half of a pair of approved indicators sharing a name, and so a slug.
const excludedIndicators = [90_366, 90_776, 92_774, 93_280];

export interface ExportDevSnapshotOptions {
  connectionString: string;
  outDir: string;
}

interface PholioSourceManifest {
  approved_indicators: number;
  excluded_observations: number;
  tables: Record<string, { rows: number; bytes: number; sha256: string }>;
}

/** Builds the private full-data archive `db import-published-snapshot` loads, from Pholio. */
export async function exportDevSnapshot(options: ExportDevSnapshotOptions): Promise<void> {
  const { outDir } = options;
  await exportPholio({
    connectionString: options.connectionString,
    outDir,
    expectedDatabase: devDatabase,
    excludedIndicators,
  });
  const exported = JSON.parse(
    await readFile(join(outDir, 'source-manifest.json'), 'utf8'),
  ) as PholioSourceManifest;
  const approvedIndicators = exported.approved_indicators + excludedIndicators.length;
  const sourceObservations =
    (exported.tables.observation?.rows ?? 0) + exported.excluded_observations;
  if (
    approvedIndicators !== expectedApprovedIndicators ||
    sourceObservations !== expectedObservations
  ) {
    throw new Error(
      `Pholio holds ${approvedIndicators} indicators and ${sourceObservations} observations; ` +
        `the published benchmark has ${expectedApprovedIndicators} and ${expectedObservations}`,
    );
  }

  const description = {
    source: devSource,
    source_database: devDatabase,
    approved_indicators: approvedIndicators,
    source_observations: sourceObservations,
    excluded_indicators: [...excludedIndicators].sort((a, b) => a - b),
    excluded_observations: exported.excluded_observations,
    source_csv_null: DATA_MIGRATION_NULL,
  };
  await writeFile(
    join(outDir, 'source-manifest.json'),
    `${JSON.stringify({ ...description, tables: exported.tables }, null, 2)}\n`,
  );

  console.log('Rekeying with deterministic UUIDs…');
  const tables = await rekeyDirectory(outDir, exported.tables);
  await writeFile(
    join(outDir, 'manifest.json'),
    `${JSON.stringify({ ...description, id_mapping: 'deterministic-uuidv7-v1', tables }, null, 2)}\n`,
  );

  const files = ['manifest.json', 'source-manifest.json', ...SEED_TABLES.map((t) => `${t}.csv.gz`)];
  await runFile('tar', ['-cf', join(outDir, 'snapshot.tar'), '-C', outDir, ...files]);
  console.log(`Archive written to ${join(outDir, 'snapshot.tar')}`);
}

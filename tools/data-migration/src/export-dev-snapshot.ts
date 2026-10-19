import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { DATA_MIGRATION_NULL, SEED_TABLES } from '@fphd/db/data-migration-contract';

import { exportPholio } from './pholio/export-pholio.ts';
import { rekeyDirectory } from './prepare-baseline.ts';
import { tidyReferenceNames } from './reference-names.ts';
import { writeActorsAsUsers } from './seed-writers.ts';

const runFile = promisify(execFile);

const devSource = 'PHOLIO_LIVE_B export';
const devDatabase = 'pholio_live_b';
// Counts omit test indicator 94204 and precede the four explicit exclusions.
const expectedSourceIndicators = 1_329;
const expectedObservations = 29_656_329;
// Each is the retired half of a pair of source indicators sharing a name, and so a slug.
const excludedIndicators = [90_366, 90_776, 92_774, 93_280];

export interface ExportDevSnapshotOptions {
  connectionString: string;
  outDir: string;
}

interface PholioSourceManifest {
  exported_indicators: number;
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
    indicatorSelection: { kind: 'development-snapshot' },
  });
  const exported = JSON.parse(
    await readFile(join(outDir, 'source-manifest.json'), 'utf8'),
  ) as PholioSourceManifest;
  const sourceIndicators = exported.exported_indicators + excludedIndicators.length;
  const sourceObservations =
    (exported.tables.observation?.rows ?? 0) + exported.excluded_observations;
  if (
    sourceIndicators !== expectedSourceIndicators ||
    sourceObservations !== expectedObservations
  ) {
    throw new Error(
      `Pholio holds ${sourceIndicators} indicators and ${sourceObservations} observations; ` +
        `the published benchmark has ${expectedSourceIndicators} and ${expectedObservations}`,
    );
  }

  const description = {
    source: devSource,
    source_database: devDatabase,
    source_indicators: sourceIndicators,
    source_observations: sourceObservations,
    excluded_indicators: [...excludedIndicators].sort((a, b) => a - b),
    excluded_observations: exported.excluded_observations,
    source_csv_null: DATA_MIGRATION_NULL,
  };
  await writeFile(
    join(outDir, 'source-manifest.json'),
    `${JSON.stringify({ ...description, tables: exported.tables }, null, 2)}\n`,
  );

  await tidyReferenceNames(outDir);
  const tidied = JSON.parse(
    await readFile(join(outDir, 'source-manifest.json'), 'utf8'),
  ) as PholioSourceManifest;
  console.log('Rekeying with deterministic UUIDs…');
  // The archive is seed files, which name their writers by user id.
  const tables = await writeActorsAsUsers(outDir, await rekeyDirectory(outDir, tidied.tables));
  await writeFile(
    join(outDir, 'manifest.json'),
    `${JSON.stringify({ ...description, reference_names: 'tidied', id_mapping: 'deterministic-uuidv7-v1', writers: 'users', tables }, null, 2)}\n`,
  );

  const files = ['manifest.json', 'source-manifest.json', ...SEED_TABLES.map((t) => `${t}.csv.gz`)];
  await runFile('tar', ['-cf', join(outDir, 'snapshot.tar'), '-C', outDir, ...files]);
  console.log(`Archive written to ${join(outDir, 'snapshot.tar')}`);
}

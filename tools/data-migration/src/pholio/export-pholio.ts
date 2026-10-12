import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DATA_MIGRATION_NULL } from '@fphd/db/data-migration-contract';
import { ensureDirectory } from '../files.ts';
import { checkSlugs } from '../indicator-checks.ts';
import { TABLES } from '../tables.ts';
import { createPholioExportContext, type StageResult } from './context.ts';
import { exportDimensions } from './dimensions.ts';
import { exportGeography } from './geography.ts';
import { exportIndicators } from './indicators.ts';
import { exportLookups } from './lookups.ts';
import { exportObservations } from './observations.ts';
import { connectToPholio, queryPholio } from './source.ts';

export interface ExportPholioOptions {
  connectionString: string;
  outDir: string;
  /** The Pholio database the connection must reach, checked before anything is read. */
  expectedDatabase: string;
  excludedIndicators?: readonly number[];
}

/**
 * Reads Pholio directly and writes the source export prepare-baseline and the dev snapshot take:
 * the same tables and columns export-live wrote from the alpha intermediate database.
 */
export async function exportPholio(options: ExportPholioOptions): Promise<void> {
  await ensureDirectory(options.outDir);
  const pool = await connectToPholio(options.connectionString);
  try {
    const [identity] = await queryPholio<{ database: string; snapshotAt: Date }>(
      pool,
      'SELECT DB_NAME() AS [database], SYSUTCDATETIME() AS snapshotAt',
    );
    if (identity?.database !== options.expectedDatabase) {
      throw new Error(
        `Connected to ${String(identity?.database)}; expected ${options.expectedDatabase}`,
      );
    }
    const snapshotAt = new Date(identity.snapshotAt).toISOString();
    const context = createPholioExportContext(
      pool,
      options.outDir,
      options.excludedIndicators ?? [],
    );

    const tables: StageResult = {};
    // Each stage fills the context the later ones read, so the order is fixed.
    const record = (written: StageResult) => {
      for (const [table, file] of Object.entries(written)) {
        console.log(`${table}: ${file?.rows.toLocaleString()} rows`);
      }
      Object.assign(tables, written);
    };
    for (const stage of [exportLookups, exportGeography, exportDimensions, exportIndicators]) {
      record(await stage(context));
    }
    // Stop before the long observation pass if any name cannot carry a public address.
    checkSlugs([...context.indicatorNames].map(([id, name]) => ({ id, name })));
    record(await exportObservations(context));
    const missing = TABLES.filter((table) => !tables[table]);
    if (missing.length > 0) throw new Error(`Pholio export wrote no ${missing.join(', ')}`);

    await writeFile(
      join(options.outDir, 'source-manifest.json'),
      `${JSON.stringify(
        {
          source: {
            system: 'fingertips',
            environment: 'live',
            database: identity.database,
            snapshot_at: snapshotAt,
            cutoff_at: snapshotAt,
          },
          approved_indicators: tables.indicator?.rows,
          excluded_indicators: [...context.excludedIndicators].sort((a, b) => a - b),
          excluded_non_approved_indicators: 0,
          excluded_future_observations: 0,
          excluded_observations: context.excludedObservations,
          source_csv_null: DATA_MIGRATION_NULL,
          tables,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.close();
  }
}

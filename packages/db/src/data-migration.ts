import type postgres from 'postgres';

import { copyInto, type DataMigrationProgressReporter } from './data-migration-copy.ts';
import type { DataMigrationManifest } from './data-migration-manifest.ts';
import {
  DATA_MIGRATION_REFERENCE_TABLES,
  DATA_MIGRATION_TABLES,
} from './data-migration-manifest.ts';
import { applyRelationships } from './data-migration-relationship-import.ts';
import { applyLegacySources } from './data-migration-sources.ts';
import {
  applyIndicatorVersionRows,
  applyUpserts,
  validateMigrationHeader,
} from './data-migration-table-import.ts';
import { type LegacySourceMap, readLegacySourceMap } from './legacy-sources.ts';

export type {
  DataMigrationProgress,
  DataMigrationProgressReporter,
} from './data-migration-copy.ts';

const referenceTables = new Set(DATA_MIGRATION_REFERENCE_TABLES);
const VERSION_CHILD_TABLES = [
  'indicator_version_topic',
  'indicator_version_classification',
  'indicator_version_source',
] as const;

async function applyBaseline(
  tx: postgres.TransactionSql,
  directory: string,
  manifest: Extract<DataMigrationManifest, { kind: 'baseline' }>,
  report: DataMigrationProgressReporter,
  legacySourceMap: LegacySourceMap = readLegacySourceMap(),
): Promise<Record<string, { upserts: number; deletes: number }>> {
  for (const table of DATA_MIGRATION_TABLES) {
    if (referenceTables.has(table)) continue;
    const [row] = await tx.unsafe<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM "${table}"`,
    );
    if (Number(row?.count) !== 0) throw new Error(`Baseline target table ${table} is not empty`);
  }

  const changes: Record<string, { upserts: number; deletes: number }> = {};
  let indicatorVersionHasLegacySources = false;
  for (const table of DATA_MIGRATION_TABLES) {
    const entry = manifest.tables[table];
    if (!entry) throw new Error(`Baseline has no ${table} entry`);
    if (referenceTables.has(table)) {
      changes[table] = { upserts: 0, deletes: 0 };
      continue;
    }
    if (table === 'indicator_version') {
      const { hasLegacySources } = await applyIndicatorVersionRows(
        tx,
        directory,
        'baseline',
        report,
      );
      indicatorVersionHasLegacySources = hasLegacySources;
      const [row] = await tx.unsafe<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM indicator_version`,
      );
      if (Number(row?.count) !== entry.rows)
        throw new Error(`Baseline row count failed for indicator_version`);
      changes[table] = { upserts: entry.rows, deletes: 0 };
      continue;
    }
    const file = `${directory}/${entry.file}`;
    const { columns } = await validateMigrationHeader(tx, table, file);
    await copyInto(
      tx,
      table,
      columns,
      file,
      `COPY into ${table}`,
      { table, phase: 'baseline' },
      report,
    );
    const [row] = await tx.unsafe<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM "${table}"`,
    );
    if (Number(row?.count) !== entry.rows)
      throw new Error(`Baseline row count failed for ${table}`);
    changes[table] = { upserts: entry.rows, deletes: 0 };
  }
  if (indicatorVersionHasLegacySources) {
    await applyLegacySources(tx, directory, legacySourceMap);
  }
  return changes;
}

async function applyDeletes(
  tx: postgres.TransactionSql,
  table: string,
  file: string,
  expected: number,
  report: DataMigrationProgressReporter,
): Promise<void> {
  const stage = `data_migration_delete_${table}`;
  await tx.unsafe(`CREATE TEMP TABLE "${stage}" (id uuid PRIMARY KEY) ON COMMIT DROP`);
  const { columns } = await validateMigrationHeader(tx, stage, file);
  await copyInto(
    tx,
    stage,
    columns,
    file,
    `loading ${table} deletes`,
    { table, phase: 'delete' },
    report,
  );
  const [staged] = await tx.unsafe<{ count: number }[]>(
    `SELECT count(*)::int AS count FROM "${stage}"`,
  );
  if (Number(staged?.count) !== expected) {
    throw new Error(`${table} staged ${staged?.count ?? 0} deletes; package declares ${expected}`);
  }
  if (table === 'indicator_version') {
    const [unpublished] = await tx.unsafe<{ count: number }[]>(`
      SELECT count(*)::int AS count FROM indicator_version
      WHERE id IN (SELECT id FROM "${stage}") AND status <> 'published'
    `);
    if (unpublished?.count) {
      throw new Error('Data migration would delete a non-published indicator version');
    }
    // Publishers attach links and age ranges to versions. Deleting a version would discard that
    // work, so the migration stops for a decision instead.
    const [published] = await tx.unsafe<{ count: number }[]>(`
      SELECT (SELECT count(*) FROM indicator_version_link WHERE indicator_version_id IN (SELECT id FROM "${stage}"))
        + (SELECT count(*) FROM indicator_version_age_range WHERE indicator_version_id IN (SELECT id FROM "${stage}"))
        AS count
    `);
    if (Number(published?.count) > 0) {
      throw new Error(
        `${published?.count} publisher links or age ranges belong to indicator versions the source no longer holds`,
      );
    }
    // The migration wrote these, and re-applies topics and classifications once the deletes are done.
    for (const child of VERSION_CHILD_TABLES) {
      await tx.unsafe(
        `DELETE FROM ${child} WHERE indicator_version_id IN (SELECT id FROM "${stage}")`,
      );
    }
  }
  const deleting =
    Number(staged?.count) > 0
      ? await tx.unsafe<{ id: string }[]>(`SELECT id FROM "${stage}" ORDER BY id LIMIT 20`)
      : [];
  let result: { count: number };
  try {
    result = await tx.unsafe(`DELETE FROM "${table}" WHERE id IN (SELECT id FROM "${stage}")`);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23503') {
      throw new Error(
        `${table} deletion is blocked by retained references (ids: ${deleting.map(({ id }) => id).join(', ')}): ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    throw error;
  }
  if (result.count !== expected) {
    throw new Error(`${table} deleted ${result.count} rows; package declares ${expected}`);
  }
}

async function applyIncremental(
  tx: postgres.TransactionSql,
  directory: string,
  manifest: Extract<DataMigrationManifest, { kind: 'incremental' }>,
  report: DataMigrationProgressReporter,
  legacySourceMap: LegacySourceMap = readLegacySourceMap(),
): Promise<Record<string, { upserts: number; deletes: number }>> {
  // Move changed children onto any new parent rows before deleting parents no longer in the
  // source snapshot. Deleting first would fail when an unchanged row still referenced a parent
  // until its upsert changed the foreign key.
  let indicatorVersionHasLegacySources = false;
  for (const table of DATA_MIGRATION_TABLES) {
    if (referenceTables.has(table)) continue;
    const entry = manifest.tables[table];
    if (!entry) throw new Error(`Incremental package has no ${table} entry`);
    if (table === 'indicator_version') {
      const { hasLegacySources } = await applyIndicatorVersionRows(tx, directory, 'upsert', report);
      indicatorVersionHasLegacySources = hasLegacySources;
      const [staged] = await tx.unsafe<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM migration_source_indicator_version`,
      );
      if (Number(staged?.count) !== entry.upserts.rows) {
        throw new Error(
          `indicator_version staged ${staged?.count ?? 0} upserts; package declares ${entry.upserts.rows}`,
        );
      }
      continue;
    }
    const { hasLegacySources } = await applyUpserts(
      tx,
      table,
      `${directory}/${entry.upserts.file}`,
      entry.upserts.rows,
      report,
    );
    if (hasLegacySources) indicatorVersionHasLegacySources = true;
  }
  if (indicatorVersionHasLegacySources) {
    await applyLegacySources(tx, directory, legacySourceMap);
  }
  for (const table of [...DATA_MIGRATION_TABLES].reverse()) {
    if (referenceTables.has(table)) continue;
    const entry = manifest.tables[table];
    if (!entry) throw new Error(`Incremental package has no ${table} entry`);
    await applyDeletes(tx, table, `${directory}/${entry.deletes.file}`, entry.deletes.rows, report);
  }
  return Object.fromEntries(
    DATA_MIGRATION_TABLES.map((table) => {
      const entry = manifest.tables[table];
      if (!entry) throw new Error(`Incremental package has no ${table} entry`);
      return [
        table,
        referenceTables.has(table)
          ? { upserts: 0, deletes: 0 }
          : { upserts: entry.upserts.rows, deletes: entry.deletes.rows },
      ];
    }),
  );
}

export interface ApplyDataMigrationResult {
  applied: boolean;
  changes: Record<string, { upserts: number; deletes: number }>;
}

export async function applyDataMigration(
  tx: postgres.TransactionSql,
  directory: string,
  manifest: DataMigrationManifest,
  packageSha256: string,
  report: DataMigrationProgressReporter = () => {},
): Promise<ApplyDataMigrationResult> {
  await tx`SELECT pg_advisory_xact_lock(hashtext('fphd-data-migration'))`;
  const [existing] = await tx<
    { packageSha256: string; tableChanges: ApplyDataMigrationResult['changes'] }[]
  >`
    SELECT package_sha256 AS "packageSha256", table_changes AS "tableChanges"
    FROM data_migration WHERE id = ${manifest.migration_id}
  `;
  if (existing) {
    if (existing.packageSha256 !== packageSha256) {
      throw new Error(
        `Migration ${manifest.migration_id} was already applied with another package`,
      );
    }
    return { applied: false, changes: existing.tableChanges };
  }

  const [latest] = await tx<{ id: string; cutoff: Date }[]>`
    SELECT id, source_cutoff_at AS cutoff
    FROM data_migration ORDER BY source_cutoff_at DESC, applied_at DESC LIMIT 1
  `;
  if (manifest.kind === 'baseline') {
    if (latest) throw new Error('A baseline can only be applied before any other data migration');
  } else {
    if (!latest || latest.id !== manifest.predecessor) {
      throw new Error(
        `Incremental predecessor ${manifest.predecessor} is not the latest migration`,
      );
    }
    if (new Date(manifest.source.cutoff_at) <= latest.cutoff) {
      throw new Error('Incremental cutoff must be strictly later than its predecessor');
    }
  }

  // Identity writes must finish before the migration reads or advances their sequence.
  await tx`LOCK TABLE indicator IN SHARE ROW EXCLUSIVE MODE`;

  const changes =
    manifest.kind === 'baseline'
      ? await applyBaseline(tx, directory, manifest, report)
      : await applyIncremental(tx, directory, manifest, report);
  await applyRelationships(tx, directory, manifest, report);
  await tx.unsafe(
    "SELECT setval('indicator_short_id_seq', GREATEST(99999, (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM indicator_short_id_seq), COALESCE((SELECT max(short_id) FROM indicator), 99999)), true)",
  );
  await tx`
    INSERT INTO data_migration
      (id, kind, package_sha256, predecessor_id, source_snapshot_at, source_cutoff_at, table_changes)
    VALUES
      (${manifest.migration_id}, ${manifest.kind}, ${packageSha256}, ${manifest.predecessor},
       ${manifest.source.snapshot_at}, ${manifest.source.cutoff_at}, ${tx.json(changes)})
  `;
  return { applied: true, changes };
}

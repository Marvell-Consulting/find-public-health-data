import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

import type postgres from 'postgres';

import { createDbFromTransaction } from './client.ts';
import type { DataMigrationManifest } from './data-migration-manifest.ts';
import {
  DATA_MIGRATION_REFERENCE_TABLES,
  DATA_MIGRATION_TABLES,
} from './data-migration-manifest.ts';
import { parseDataMigrationRelationships } from './data-migration-relationships.ts';
import { applyIndicatorTopics } from './indicator-topic-repository.ts';
import { type LegacySourceMap, mapLegacySources, readLegacySourceMap } from './legacy-sources.ts';
import { readCsvHeader } from './seeding.ts';

const COPY_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
// Matches the deployed operations job's outer execution limit.
const COPY_COMPLETION_TIMEOUT_MS = 6 * 60 * 60 * 1_000;

const LEGACY_SOURCE_COLUMNS = ['numerator_source_id', 'denominator_source_id'] as const;

const referenceTables = new Set(DATA_MIGRATION_REFERENCE_TABLES);

// The rows the migration itself writes against a version.
const VERSION_CHILD_TABLES = [
  'indicator_version_topic',
  'indicator_version_classification',
  'indicator_version_source',
] as const;

const PHOLIO_CI_METHOD_NAMES: Record<string, string> = {
  'Normal approximation': 'Wald normal approximation',
  'Other method - see below': 'Other method',
};

// The core rows are already present with fixed UUIDs from packages/db/data/*.json.
interface CoreDataLookup {
  table: 'ci_method' | 'comparator_method';
  column: 'ci_method_id' | 'comparator_method_id';
  renames: Record<string, string>;
}

const CORE_DATA_LOOKUPS: CoreDataLookup[] = [
  { table: 'ci_method', column: 'ci_method_id', renames: PHOLIO_CI_METHOD_NAMES },
  { table: 'comparator_method', column: 'comparator_method_id', renames: {} },
];

export interface DataMigrationProgress {
  table: string;
  phase: 'baseline' | 'upsert' | 'delete' | 'relationships';
  state: 'started' | 'progress' | 'complete';
  percent?: number;
}

export type DataMigrationProgressReporter = (progress: DataMigrationProgress) => void;

async function copyWithProgress(
  file: string,
  writable: Writable,
  label: string,
  reportPercent: (percent: number) => void,
): Promise<void> {
  const source = createReadStream(file);
  const totalBytes = (await stat(file)).size;
  let readBytes = 0;
  let lastReported = -5;
  source.on('data', (chunk: string | Buffer) => {
    readBytes += Buffer.byteLength(chunk);
    const percent = Math.min(100, Math.floor((readBytes * 100) / totalBytes));
    if (percent >= lastReported + 5) {
      lastReported = percent;
      reportPercent(percent);
    }
  });
  const decompressed = createGunzip();
  const abort = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  const stalled = new Promise<'stalled'>((resolve) => {
    const stop = () => resolve('stalled');
    timeout = setTimeout(stop, COPY_IDLE_TIMEOUT_MS).unref();
    decompressed.once('end', () => {
      clearTimeout(timeout);
      timeout = setTimeout(stop, COPY_COMPLETION_TIMEOUT_MS).unref();
    });
  });
  const progress = () => timeout?.refresh();
  decompressed.on('data', progress);
  const copying = pipeline(source, decompressed, writable, {
    end: true,
    signal: abort.signal,
  });
  try {
    if ((await Promise.race([copying.then(() => 'finished' as const), stalled])) === 'stalled') {
      abort.abort();
      await copying.catch(() => undefined);
      throw new Error(`${label} stopped making progress`);
    }
  } finally {
    clearTimeout(timeout);
    decompressed.off('data', progress);
  }
}

function quoteIdentifiers(values: readonly string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '""')}"`).join(', ');
}

interface TableColumnInfo {
  name: string;
  notNull: boolean;
  hasDefault: boolean;
}

async function tableColumnInfo(
  tx: postgres.TransactionSql,
  table: string,
): Promise<TableColumnInfo[]> {
  return tx<TableColumnInfo[]>`
    SELECT attname AS name, attnotnull AS "notNull", atthasdef AS "hasDefault"
    FROM pg_attribute
    WHERE attrelid = ${table}::regclass AND attnum > 0 AND NOT attisdropped
    ORDER BY attnum
  `;
}

async function copyInto(
  tx: postgres.TransactionSql,
  target: string,
  columns: readonly string[],
  file: string,
  label: string,
  progress: Omit<DataMigrationProgress, 'state' | 'percent'>,
  report: DataMigrationProgressReporter,
): Promise<void> {
  report({ ...progress, state: 'started' });
  const writable = await tx
    .unsafe(
      `COPY "${target}" (${quoteIdentifiers(columns)}) FROM STDIN WITH (FORMAT csv, HEADER true)`,
    )
    .writable();
  await copyWithProgress(file, writable, label, (percent) =>
    report({ ...progress, state: 'progress', percent }),
  );
  report({ ...progress, state: 'complete' });
}

async function validateHeaderStrippingLegacy(
  tx: postgres.TransactionSql,
  table: string,
  file: string,
): Promise<{ rawHeader: string[]; columns: string[]; hasLegacySources: boolean }> {
  const rawHeader = await readCsvHeader(file);
  const targetInfo = await tableColumnInfo(tx, table);
  const targetNames = new Set(targetInfo.map(({ name }) => name));
  const legacySet = new Set<string>(LEGACY_SOURCE_COLUMNS);

  const hasLegacySources =
    table === 'indicator_version' && rawHeader.some((col) => legacySet.has(col));
  const columns = hasLegacySources ? rawHeader.filter((col) => !legacySet.has(col)) : rawHeader;

  const unknown = columns.filter((col) => !targetNames.has(col));
  if (unknown.length > 0) {
    throw new Error(`${table} CSV has columns the target table does not: ${unknown.join(', ')}`);
  }

  const columnSet = new Set(columns);
  const missing = targetInfo
    .filter(({ notNull, hasDefault }) => notNull && !hasDefault)
    .map(({ name }) => name)
    .filter((name) => !columnSet.has(name));
  if (missing.length > 0) {
    throw new Error(`${table} CSV is missing required columns: ${missing.join(', ')}`);
  }

  return { rawHeader, columns, hasLegacySources };
}

/**
 * Stages the package's rows for a core data table and builds a temp map from source IDs to the
 * live core data IDs of the same name, ready for indicator_version to join through. Mirrors
 * seeding.ts's mapToCoreData. Maps only the rows the staged versions name, so it runs after
 * applyIndicatorVersionRows has staged migration_source_indicator_version.
 */
async function stageCoreDataMap(
  tx: postgres.TransactionSql,
  { table, column, renames }: CoreDataLookup,
  directory: string,
): Promise<void> {
  const file = `${directory}/${table}.csv.gz`;
  const rawHeader = await readCsvHeader(file);
  const columnDefs = rawHeader.map((c) => `"${c.replaceAll('"', '""')}" text`).join(', ');
  await tx.unsafe(`CREATE TEMP TABLE migration_source_${table} (${columnDefs}) ON COMMIT DROP`);
  await copyInto(
    tx,
    `migration_source_${table}`,
    rawHeader,
    file,
    `staging ${table}`,
    { table, phase: 'upsert' },
    () => {},
  );

  const sourceRows = await tx.unsafe<{ id: string; name: string }[]>(`
    SELECT DISTINCT s.id, s.name FROM migration_source_${table} s
    JOIN migration_source_indicator_version v ON v.${column} = s.id::uuid
  `);
  const coreRows = await tx.unsafe<{ id: string; name: string }[]>(
    `SELECT id::text AS id, name FROM "${table}"`,
  );
  const coreIds = new Map(coreRows.map(({ id, name }) => [name, id]));
  const mapping = sourceRows.map(({ id, name }) => ({
    sourceId: id,
    coreId: coreIds.get(renames[name] ?? name),
    name,
  }));
  const unmatched = mapping.filter(({ coreId }) => coreId === undefined).map(({ name }) => name);
  if (unmatched.length > 0) {
    throw new Error(
      `No core ${table} for: ${unmatched.join(', ')}. Add it to the core data file and run \`db import-core-data\``,
    );
  }

  await tx.unsafe(
    `CREATE TEMP TABLE migration_${table}_map (source_id uuid, core_id uuid) ON COMMIT DROP`,
  );
  if (mapping.length > 0) {
    await tx`INSERT INTO ${tx(`migration_${table}_map`)} ${tx(
      mapping.map(({ sourceId, coreId }) => ({ source_id: sourceId, core_id: coreId })),
    )}`;
  }

  const [dangling] = await tx.unsafe<{ count: number }[]>(`
    SELECT count(*)::int AS count FROM migration_source_indicator_version v
    WHERE v.${column} IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM migration_${table}_map m WHERE m.source_id = v.${column})
  `);
  if (dangling?.count) {
    throw new Error(`${dangling.count} migrated versions name a ${table} the source does not hold`);
  }
}

/**
 * Stages indicator_version rows (with legacy source and core data columns), builds the core data
 * maps, then inserts into indicator_version with FK references rewritten to core data IDs. Mirrors
 * seeding.ts's loadIndicatorVersions.
 */
async function applyIndicatorVersionRows(
  tx: postgres.TransactionSql,
  directory: string,
  phase: 'baseline' | 'upsert',
  report: DataMigrationProgressReporter,
): Promise<{ hasLegacySources: boolean }> {
  const file = `${directory}/indicator_version.csv.gz`;
  const { rawHeader, columns, hasLegacySources } = await validateHeaderStrippingLegacy(
    tx,
    'indicator_version',
    file,
  );

  await tx.unsafe(
    `CREATE TEMP TABLE migration_source_indicator_version (LIKE indicator_version INCLUDING DEFAULTS) ON COMMIT DROP`,
  );
  await tx.unsafe(
    `ALTER TABLE migration_source_indicator_version ADD COLUMN numerator_source_id uuid, ADD COLUMN denominator_source_id uuid`,
  );
  await copyInto(
    tx,
    'migration_source_indicator_version',
    rawHeader,
    file,
    `staging indicator_version`,
    { table: 'indicator_version', phase },
    report,
  );

  for (const lookup of CORE_DATA_LOOKUPS) {
    await stageCoreDataMap(tx, lookup, directory);
  }

  const mapped = new Map<string, string>(
    CORE_DATA_LOOKUPS.map(({ table, column }) => [column, `migration_${table}_map.core_id`]),
  );
  const columnList = quoteIdentifiers(columns);
  const selectList = columns.map((c) => mapped.get(c) ?? `v."${c}"`).join(', ');
  const joins = CORE_DATA_LOOKUPS.map(
    ({ table, column }) =>
      `LEFT JOIN migration_${table}_map ON migration_${table}_map.source_id = v.${column}`,
  ).join('\n    ');

  if (phase === 'baseline') {
    await tx.unsafe(`
      INSERT INTO indicator_version (${columnList})
      SELECT ${selectList} FROM migration_source_indicator_version v
      ${joins}
    `);
  } else {
    const assignments = columns
      .filter((c) => c !== 'id')
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');
    const conflict = assignments.length === 0 ? 'DO NOTHING' : `DO UPDATE SET ${assignments}`;
    await tx.unsafe(`
      INSERT INTO indicator_version (${columnList})
      SELECT ${selectList} FROM migration_source_indicator_version v
      ${joins}
      ON CONFLICT (id) ${conflict}
    `);
  }

  return { hasLegacySources };
}

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
    const { columns } = await validateHeaderStrippingLegacy(tx, table, file);
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
  await copyInto(
    tx,
    stage,
    ['id'],
    file,
    `loading ${table} deletes`,
    { table, phase: 'delete' },
    report,
  );
  if (table === 'indicator_version') {
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
  const result = await tx.unsafe(`DELETE FROM "${table}" WHERE id IN (SELECT id FROM "${stage}")`);
  if (result.count !== expected) {
    throw new Error(`${table} deleted ${result.count} rows; package declares ${expected}`);
  }
}

async function applyUpserts(
  tx: postgres.TransactionSql,
  table: string,
  file: string,
  expected: number,
  report: DataMigrationProgressReporter,
): Promise<{ hasLegacySources: boolean }> {
  const { columns, hasLegacySources } = await validateHeaderStrippingLegacy(tx, table, file);

  const stage = `data_migration_upsert_${table}`;
  await tx.unsafe(
    `CREATE TEMP TABLE "${stage}" (LIKE "${table}" INCLUDING DEFAULTS) ON COMMIT DROP`,
  );
  await copyInto(
    tx,
    stage,
    columns,
    file,
    `loading ${table} upserts`,
    { table, phase: 'upsert' },
    report,
  );
  const [staged] = await tx.unsafe<{ count: number }[]>(
    `SELECT count(*)::int AS count FROM "${stage}"`,
  );
  if (Number(staged?.count) !== expected) {
    throw new Error(`${table} staged ${staged?.count ?? 0} upserts; package declares ${expected}`);
  }
  const assignments = columns
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(', ');
  const conflict = assignments.length === 0 ? 'DO NOTHING' : `DO UPDATE SET ${assignments}`;
  await tx.unsafe(
    `INSERT INTO "${table}" (${quoteIdentifiers(columns)}) SELECT ${quoteIdentifiers(columns)} FROM "${stage}" ON CONFLICT (id) ${conflict}`,
  );
  return { hasLegacySources };
}

/**
 * Resolves legacy numerator/denominator source references to core provider/source pairs and
 * inserts rows into indicator_version_source. Requires migration_source_indicator_version (with
 * numerator_source_id and denominator_source_id columns) to be alive in the transaction, as
 * applyIndicatorVersionRows leaves it.
 */
async function applyLegacySources(
  tx: postgres.TransactionSql,
  directory: string,
  legacySourceMap: LegacySourceMap,
): Promise<void> {
  await tx.unsafe(
    `CREATE TEMP TABLE migration_numerator_denominator_source (id uuid PRIMARY KEY, name text, url text) ON COMMIT DROP`,
  );
  const file = `${directory}/numerator_denominator_source.csv.gz`;
  await copyInto(
    tx,
    'migration_numerator_denominator_source',
    ['id', 'name', 'url'],
    file,
    'loading legacy sources',
    { table: 'indicator_version_source', phase: 'upsert' },
    () => {},
  );

  const used = await tx<{ id: string; name: string }[]>`
    SELECT s.id, s.name FROM migration_numerator_denominator_source s
    WHERE s.id IN (
      SELECT numerator_source_id FROM migration_source_indicator_version
      UNION SELECT denominator_source_id FROM migration_source_indicator_version
    )
  `;
  const [dangling] = await tx<{ count: number }[]>`
    SELECT count(*)::int AS count FROM migration_source_indicator_version v
    CROSS JOIN LATERAL (VALUES (v.numerator_source_id), (v.denominator_source_id)) AS p (id)
    WHERE p.id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM migration_numerator_denominator_source s WHERE s.id = p.id)
  `;
  if (dangling?.count) {
    throw new Error(`${dangling.count} migrated sources name a row the source list does not hold`);
  }

  const pairs = await mapLegacySources(tx, used, legacySourceMap);

  await tx.unsafe(
    `CREATE TEMP TABLE migration_source_pair_map (legacy_id uuid, position smallint, provider_id uuid, source_id uuid) ON COMMIT DROP`,
  );
  if (pairs.length > 0) {
    await tx`INSERT INTO migration_source_pair_map ${tx(
      pairs.map(({ legacyId, position, providerId, sourceId }) => ({
        legacy_id: legacyId,
        position,
        provider_id: providerId,
        source_id: sourceId,
      })),
    )}`;
  }

  await tx`
    INSERT INTO indicator_version_source
      (indicator_version_id, part, position, provider_id, source_id)
    SELECT v.id, p.part, m.position, m.provider_id, m.source_id
    FROM migration_source_indicator_version v
    CROSS JOIN LATERAL (
      VALUES ('numerator', v.numerator_source_id), ('denominator', v.denominator_source_id)
    ) AS p (part, legacy_id)
    JOIN migration_source_pair_map m ON m.legacy_id = p.legacy_id
    ON CONFLICT (indicator_version_id, part, position) DO UPDATE
      SET provider_id = EXCLUDED.provider_id, source_id = EXCLUDED.source_id
  `;
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
      return [table, { upserts: entry.upserts.rows, deletes: entry.deletes.rows }];
    }),
  );
}

export interface ApplyDataMigrationResult {
  applied: boolean;
  changes: Record<string, { upserts: number; deletes: number }>;
}

async function applyRelationships(
  tx: postgres.TransactionSql,
  directory: string,
  manifest: DataMigrationManifest,
  report: DataMigrationProgressReporter,
): Promise<void> {
  report({ table: 'indicator_relationships', phase: 'relationships', state: 'started' });
  const relationships = parseDataMigrationRelationships(
    JSON.parse(await readFile(`${directory}/${manifest.relationships.file}`, 'utf8')),
  );
  const actual = (
    await tx<{ shortId: number }[]>`
    SELECT short_id AS "shortId" FROM indicator ORDER BY short_id
  `
  ).map(({ shortId }) => shortId);
  const declared = [...relationships.indicators].sort((left, right) => left - right);
  if (actual.length !== declared.length || actual.some((id, index) => id !== declared[index])) {
    throw new Error('Reviewed relationship coverage does not match the migrated indicators');
  }
  if (relationships.indicators.length !== manifest.relationships.rows) {
    throw new Error('Reviewed relationship coverage count does not match the manifest');
  }
  await tx`DELETE FROM indicator_version_topic`;
  await tx`DELETE FROM indicator_version_classification`;
  const summary = await applyIndicatorTopics(createDbFromTransaction(tx), relationships);
  if (
    summary.unknownIndicators.length > 0 ||
    summary.unknownTopics.length > 0 ||
    summary.unknownClassifications.length > 0 ||
    summary.links !== relationships.indicatorTopics.length ||
    summary.classificationLinks !== relationships.indicatorClassifications.length
  ) {
    throw new Error('Reviewed indicator relationships did not apply completely');
  }
  report({ table: 'indicator_relationships', phase: 'relationships', state: 'complete' });
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

  const changes =
    manifest.kind === 'baseline'
      ? await applyBaseline(tx, directory, manifest, report)
      : await applyIncremental(tx, directory, manifest, report);
  const [approval] = await tx.unsafe<{ count: number }[]>(
    "SELECT count(*)::int AS count FROM indicator_version WHERE status IS DISTINCT FROM 'published'",
  );
  if (Number(approval?.count) !== 0)
    throw new Error('Data migration contains a non-published indicator version');
  await applyRelationships(tx, directory, manifest, report);
  await tx.unsafe(
    "SELECT setval('indicator_short_id_seq', GREATEST(99999, COALESCE((SELECT max(short_id) FROM indicator), 99999)), true)",
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

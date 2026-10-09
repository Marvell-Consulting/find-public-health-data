import type postgres from 'postgres';
import {
  copyInto,
  type DataMigrationProgressReporter,
  quoteIdentifiers,
} from './data-migration-copy.ts';
import { readCsvHeader } from './seeding.ts';

const LEGACY_SOURCE_COLUMNS = ['numerator_source_id', 'denominator_source_id'] as const;

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

export async function validateMigrationHeader(
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
    .filter(
      ({ name, notNull, hasDefault }) =>
        name === 'id' || (table === 'indicator' && name === 'short_id') || (notNull && !hasDefault),
    )
    .map(({ name }) => name)
    .filter((name) => !columnSet.has(name));
  if (table === 'indicator_version') {
    missing.push(...LEGACY_SOURCE_COLUMNS.filter((column) => !rawHeader.includes(column)));
  }
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
export async function applyIndicatorVersionRows(
  tx: postgres.TransactionSql,
  directory: string,
  phase: 'baseline' | 'upsert',
  report: DataMigrationProgressReporter,
): Promise<{ hasLegacySources: boolean }> {
  const file = `${directory}/indicator_version.csv.gz`;
  const { rawHeader, columns, hasLegacySources } = await validateMigrationHeader(
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

  const [unpublished] = await tx<{ count: number }[]>`
    SELECT count(*)::int AS count FROM migration_source_indicator_version
    WHERE status IS DISTINCT FROM 'published'
  `;
  if (unpublished?.count) {
    throw new Error('Data migration contains a non-published indicator version');
  }

  const [draftConflict] = await tx<{ count: number }[]>`
    SELECT count(*)::int AS count FROM migration_source_indicator_version staged
    JOIN indicator_version existing ON existing.id = staged.id
    WHERE existing.status <> 'published'
  `;
  if (draftConflict?.count) {
    throw new Error('Data migration would overwrite a non-published indicator version');
  }

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

export async function applyUpserts(
  tx: postgres.TransactionSql,
  table: string,
  file: string,
  expected: number,
  report: DataMigrationProgressReporter,
): Promise<{ hasLegacySources: boolean }> {
  const { columns, hasLegacySources } = await validateMigrationHeader(tx, table, file);

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

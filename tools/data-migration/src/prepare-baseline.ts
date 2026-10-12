import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from '@fphd/config';
import { dimensionKey } from '@fphd/db';
import {
  assertCompleteTableSet,
  type BaselineManifest,
  baselineManifestSchema,
  DATA_MIGRATION_FORMAT_VERSION,
  DATA_MIGRATION_NULL,
  DATA_MIGRATION_SCHEMA,
  parseDataMigrationRelationships,
} from '@fphd/db/data-migration-contract';

import { readGzipCsv, transformGzipCsv } from './csv.ts';
import { fileRecord } from './files.ts';
import { normaliseHeader, normaliseRow } from './normalise.ts';
import { foreignKeyIndexes, TABLE_TAGS, TABLES } from './tables.ts';

const sourceFileSchema = z.object({
  file: z.string(),
  rows: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const sourceManifestSchema = z.object({
  source: z.object({
    system: z.literal('fingertips'),
    environment: z.literal('live'),
    database: z.string().min(1),
    snapshot_at: z.iso.datetime({ offset: true }),
    cutoff_at: z.iso.datetime({ offset: true }),
  }),
  approved_indicators: z.number().int().positive(),
  excluded_indicators: z.array(z.number().int()).default([]),
  excluded_non_approved_indicators: z.number().int().nonnegative(),
  excluded_future_observations: z.number().int().nonnegative(),
  excluded_observations: z.number().int().nonnegative().default(0),
  source_csv_null: z.literal(DATA_MIGRATION_NULL),
  tables: z.record(z.string(), sourceFileSchema),
});

type SourceManifest = z.infer<typeof sourceManifestSchema>;

async function verifySourceExport(directory: string, source: SourceManifest): Promise<void> {
  assertCompleteTableSet(source.tables);
  if (source.tables.indicator?.rows !== source.approved_indicators) {
    throw new Error('Source indicator count does not match its manifest');
  }
  for (const table of TABLES) {
    const expected = source.tables[table];
    if (!expected || expected.file !== `${table}.csv.gz`) {
      throw new Error(`Source export has an unexpected file for ${table}`);
    }
    const actual = await fileRecord(join(directory, expected.file), expected.file, expected.rows);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Source export integrity check failed for ${table}`);
    }
  }
}

export function deterministicUuid(table: string, sourceId: string): string {
  if (!/^[1-9][0-9]*$/.test(sourceId)) {
    throw new Error(`${table} id is not a positive integer: ${sourceId}`);
  }
  const numeric = BigInt(sourceId);
  const encoded = 2n * numeric;
  if (encoded >= 1n << 62n)
    throw new Error(`${table} id is outside the supported range: ${sourceId}`);
  const tag = TABLE_TAGS[table];
  if (tag === undefined) throw new Error(`Unknown table: ${table}`);
  const timestamp = 1_777_593_600_000n;
  const value = (timestamp << 80n) | (0x7n << 76n) | (BigInt(tag) << 64n) | (0x2n << 62n) | encoded;
  const hex = value.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normaliseConfig(value: string): string {
  if (value === '' || value === DATA_MIGRATION_NULL) return value;
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'string') return value;
  return JSON.stringify(
    Object.fromEntries(
      parsed.split(',').map((pair) => {
        const [key = '', ...parts] = pair.split(':');
        const raw = parts.join(':').trim();
        return [key.trim(), /^-?\d+$/.test(raw) ? Number(raw) : raw];
      }),
    ),
  );
}

export async function rekeyDirectory(
  directory: string,
  expectedRows: Record<string, { rows: number }> | undefined,
): Promise<BaselineManifest['tables']> {
  const tables: BaselineManifest['tables'] = {};
  for (const table of TABLES) {
    const path = join(directory, `${table}.csv.gz`);
    let fkIndexes: [number, string][] = [];
    const rows = await transformGzipCsv(
      path,
      (row, header) => {
        const idIndex = header.indexOf('id');
        if (idIndex === -1) throw new Error(`${table} has no id column`);
        const oldId = row[idIndex];
        if (oldId === undefined) throw new Error(`${table} has an empty id`);
        row[idIndex] = deterministicUuid(table, oldId);
        for (const [index, target] of fkIndexes) {
          const value = row[index];
          if (value !== undefined && value !== '' && value !== DATA_MIGRATION_NULL) {
            row[index] = deterministicUuid(target, value);
          }
        }
        if (table === 'observation') {
          const keyIndex = header.indexOf('dimension_key');
          if (keyIndex !== -1) {
            const sourceKey = row[keyIndex] ?? '';
            row[keyIndex] = dimensionKey(
              sourceKey === ''
                ? []
                : sourceKey.split(',').map((id) => deterministicUuid('dimension_value', id)),
            );
          }
        }
        // Positions come from the source header, so normalising, which can add columns, runs last.
        row = normaliseRow(table, header, row);
        if (table === 'indicator') {
          return [...row.slice(0, idIndex + 1), oldId, ...row.slice(idIndex + 1)];
        }
        return row;
      },
      (header) => {
        fkIndexes = foreignKeyIndexes(table, header);
        header = normaliseHeader(table, header);
        if (table !== 'indicator') return header;
        const idIndex = header.indexOf('id');
        return [...header.slice(0, idIndex + 1), 'short_id', ...header.slice(idIndex + 1)];
      },
    );
    if (expectedRows && rows !== expectedRows[table]?.rows) {
      throw new Error(`${table} row count changed during rekeying`);
    }
    tables[table] = await fileRecord(path, `${table}.csv.gz`, rows);
    console.log(`${table}: ${rows.toLocaleString()} rows rekeyed`);
  }
  return tables;
}

export async function prepareBaseline(
  directory: string,
  migrationId: string,
  relationshipsPath: string,
): Promise<void> {
  const source = sourceManifestSchema.parse(
    JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8')),
  );
  const relationships = parseDataMigrationRelationships(
    JSON.parse(await readFile(relationshipsPath, 'utf8')),
  );
  const withTopics = new Set(relationships.indicatorTopics.map(({ fingertipsId }) => fingertipsId));
  const withoutTopics = relationships.indicators.filter((id) => !withTopics.has(id));
  if (withoutTopics.length > 0) {
    throw new Error(`Reviewed indicators have no topic: ${withoutTopics.join(', ')}`);
  }
  await verifySourceExport(directory, source);
  const indicatorRows = readGzipCsv(join(directory, 'indicator.csv.gz'))[Symbol.asyncIterator]();
  const header = (await indicatorRows.next()).value;
  if (!header) throw new Error('Source indicator file has no header');
  const idIndex = header.indexOf('id');
  const exportedIndicators: number[] = [];
  for (;;) {
    const next = await indicatorRows.next();
    if (next.done) break;
    exportedIndicators.push(Number(next.value[idIndex]));
  }
  const declaredIndicators = [...relationships.indicators].sort((left, right) => left - right);
  exportedIndicators.sort((left, right) => left - right);
  if (
    idIndex === -1 ||
    exportedIndicators.length !== declaredIndicators.length ||
    exportedIndicators.some((id, index) => id !== declaredIndicators[index])
  ) {
    throw new Error('Reviewed relationship coverage does not match the exported indicators');
  }

  const relationshipsFile = 'indicator-relationships.json';
  const relationshipsTarget = join(directory, relationshipsFile);
  await copyFile(relationshipsPath, relationshipsTarget);
  const relationshipRecord = await fileRecord(
    relationshipsTarget,
    relationshipsFile,
    relationships.indicators.length,
  );
  const tables = await rekeyDirectory(directory, source.tables);

  const manifest = baselineManifestSchema.parse({
    format_version: DATA_MIGRATION_FORMAT_VERSION,
    schema: DATA_MIGRATION_SCHEMA,
    migration_id: migrationId,
    kind: 'baseline',
    predecessor: null,
    relationships: relationshipRecord,
    source: source.source,
    source_csv_null: DATA_MIGRATION_NULL,
    id_mapping: 'deterministic-uuidv7-v1',
    tables,
  });
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

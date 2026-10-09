import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const DATA_MIGRATION_KINDS = ['baseline', 'incremental'] as const;

/** Immutable record of each live-data package applied to this database. */
export const dataMigration = pgTable(
  'data_migration',
  {
    id: text().primaryKey(),
    kind: text({ enum: DATA_MIGRATION_KINDS }).notNull(),
    packageSha256: text().notNull(),
    predecessorId: text(),
    sourceSnapshotAt: timestamp({ withTimezone: true }).notNull(),
    sourceCutoffAt: timestamp({ withTimezone: true }).notNull(),
    appliedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    tableChanges: jsonb().$type<Record<string, { upserts: number; deletes: number }>>().notNull(),
  },
  (t) => [
    check('data_migration_kind_check', sql`${t.kind} IN ('baseline', 'incremental')`),
    check('data_migration_sha256_check', sql`${t.packageSha256} ~ '^[a-f0-9]{64}$'`),
  ],
);

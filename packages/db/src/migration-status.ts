import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { z } from '@fphd/config';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import type postgres from 'postgres';

// Resolves identically from src/ and from dist/, both of which sit one level under the
// package root alongside drizzle/.
export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/**
 * `applied` and `pending` are the states drizzle's migrator acts on. The other three it
 * cannot see, because it reads one row — the newest — and compares timestamps:
 *
 * - `tampered`: applied, but the file on disk no longer hashes to what was recorded.
 * - `skipped`: never applied and never will be, because something newer already has been.
 *   Two branches merged out of order produce this, silently.
 * - `unknown`: recorded but absent from this build, so the database is ahead of the image.
 */
export type MigrationState = 'applied' | 'pending' | 'tampered' | 'skipped' | 'unknown';

export interface LocalMigration {
  tag: string;
  hash: string;
  folderMillis: number;
}

export interface AppliedMigration {
  hash: string;
  createdAt: number;
}

export interface MigrationReport extends LocalMigration {
  state: MigrationState;
  appliedAt: number | undefined;
}

const journalSchema = z.object({
  entries: z.array(z.object({ when: z.number(), tag: z.string() })),
});

/**
 * Hashes come from drizzle's own `readMigrationFiles`, so this cannot drift from what the
 * migrator records; the journal is read only for the tags, which that function drops.
 */
export function readLocalMigrations(folder: string = migrationsFolder): LocalMigration[] {
  const journalFile = `${folder}/meta/_journal.json`;
  const journal = parseJournal(readFileSync(journalFile, 'utf8'), journalFile);
  const tags = new Map(journal.entries.map((entry) => [entry.when, entry.tag]));

  return readMigrationFiles({ migrationsFolder: folder }).map((migration) => ({
    tag: tags.get(migration.folderMillis) ?? `untagged-${migration.folderMillis}`,
    hash: migration.hash,
    folderMillis: migration.folderMillis,
  }));
}

function parseJournal(contents: string, file: string): z.infer<typeof journalSchema> {
  const parsed = journalSchema.safeParse(JSON.parse(contents));
  if (!parsed.success) {
    throw new Error(`${file} is not a drizzle migration journal: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** An empty list for a database that has never been migrated, not an error. */
export async function readAppliedMigrations(sql: postgres.Sql): Promise<AppliedMigration[]> {
  const [table] = await sql<{ present: boolean }[]>`
    SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present
  `;
  if (table?.present !== true) {
    return [];
  }

  const rows = await sql<{ hash: string; created_at: string }[]>`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `;
  return rows.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) }));
}

/**
 * Pure, so the states are unit-tested rather than inferred from a migration run. Matching is
 * on `folderMillis`, the same key the migrator writes into `created_at`.
 */
export function compareMigrations(
  local: readonly LocalMigration[],
  applied: readonly AppliedMigration[],
): MigrationReport[] {
  const watermark = applied.reduce(
    (newest, migration) => Math.max(newest, migration.createdAt),
    Number.NEGATIVE_INFINITY,
  );
  const appliedByMillis = new Map(applied.map((migration) => [migration.createdAt, migration]));
  const localByMillis = new Set(local.map((migration) => migration.folderMillis));

  const known = local.map((migration): MigrationReport => {
    const record = appliedByMillis.get(migration.folderMillis);
    if (record === undefined) {
      return {
        ...migration,
        state: migration.folderMillis > watermark ? 'pending' : 'skipped',
        appliedAt: undefined,
      };
    }
    return {
      ...migration,
      state: record.hash === migration.hash ? 'applied' : 'tampered',
      appliedAt: record.createdAt,
    };
  });

  const ahead = applied
    .filter((migration) => !localByMillis.has(migration.createdAt))
    .map(
      (migration): MigrationReport => ({
        tag: `untagged-${migration.createdAt}`,
        hash: migration.hash,
        folderMillis: migration.createdAt,
        state: 'unknown',
        appliedAt: migration.createdAt,
      }),
    );

  return [...known, ...ahead].sort((a, b) => a.folderMillis - b.folderMillis);
}

const BLOCKING_STATES: readonly MigrationState[] = ['tampered', 'skipped'];

export function blockingMigrations(reports: readonly MigrationReport[]): MigrationReport[] {
  return reports.filter((report) => BLOCKING_STATES.includes(report.state));
}

/**
 * Both blocking states are silent in drizzle's migrator: it would report success having
 * applied nothing. Refusing is the whole point of the check.
 */
export function assertMigratable(reports: readonly MigrationReport[]): void {
  const blocked = blockingMigrations(reports);
  if (blocked.length === 0) {
    return;
  }

  const detail = blocked.map((report) => `${report.tag} (${report.state})`).join(', ');
  throw new Error(
    `Refusing to migrate: ${detail}. ` +
      'A tampered migration no longer matches what was applied; a skipped one is older than ' +
      'a migration already applied and would never run. Neither is resolved by running again.',
  );
}

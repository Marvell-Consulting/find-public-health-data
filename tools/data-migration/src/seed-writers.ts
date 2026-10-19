import { join } from 'node:path';

import { schema } from '@fphd/db';
import type { BaselineManifest } from '@fphd/db/data-migration-contract';

import { transformGzipCsv } from './csv.ts';
import { fileRecord } from './files.ts';

// Seed files name their writers by user id. A package names them as text, which the receiver
// maps itself, so only the exports that write seed files use these.

// The writer an export names, as the system user it is.
const ACTOR_USER_IDS: Record<string, string> = {
  'pholio-migration': schema.SYSTEM_USER_IDS.pholioMigration,
};
// The columns naming a row's writer. observation.created_by is not one: the loader ignores it.
export const ACTOR_COLUMNS: Record<string, readonly string[]> = {
  indicator_version: ['created_by', 'updated_by'],
  upload_batch: ['uploaded_by'],
};

/** The id of the user a writer is, or an error naming a writer no user stands for. */
export function actorUserId(table: string, actor: unknown): string {
  const userId = typeof actor === 'string' ? ACTOR_USER_IDS[actor] : undefined;
  if (userId === undefined) {
    throw new Error(`${table} names a writer with no user: ${String(actor)}`);
  }
  return userId;
}

/** Rewrites the writers in a directory's seed files as user ids, and returns the files' new records. */
export async function writeActorsAsUsers(
  directory: string,
  tables: BaselineManifest['tables'],
): Promise<BaselineManifest['tables']> {
  const rewritten = { ...tables };
  for (const [table, columns] of Object.entries(ACTOR_COLUMNS)) {
    const file = `${table}.csv.gz`;
    const rows = await transformGzipCsv(join(directory, file), (row, header) =>
      row.map((value, index) =>
        columns.includes(header[index] ?? '') ? actorUserId(table, value) : value,
      ),
    );
    rewritten[table] = await fileRecord(join(directory, file), file, rows);
  }
  return rewritten;
}

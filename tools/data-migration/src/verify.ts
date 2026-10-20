import { join } from 'node:path';

import {
  assertCompleteTableSet,
  assertMigrationFileNames,
  type DataMigrationManifest,
} from '@fphd/db-operations/data-migration-contract';

import { fileRecord } from './files.ts';

export async function verifyPackageFiles(
  directory: string,
  manifest: DataMigrationManifest,
): Promise<void> {
  assertCompleteTableSet(manifest.tables);
  assertMigrationFileNames(manifest);
  const entries = Object.values(manifest.tables).flatMap((table) =>
    'file' in table ? [table] : [table.upserts, table.deletes],
  );
  entries.push(manifest.relationships);
  for (const expected of entries) {
    const actual = await fileRecord(join(directory, expected.file), expected.file, expected.rows);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Package integrity check failed for ${expected.file}`);
    }
  }
}

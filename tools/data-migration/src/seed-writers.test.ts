import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { schema } from '@fphd/db';
import { afterEach, expect, it } from 'vitest';
import { readGzipCsv } from './csv.ts';
import { fileRecord } from './files.ts';
import { actorUserId, writeActorsAsUsers } from './seed-writers.ts';

const MIGRATED = schema.SYSTEM_USER_IDS.pholioMigration;
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture(versions: string) {
  const directory = await mkdtemp(join(tmpdir(), 'seed-writers-'));
  directories.push(directory);
  for (const [table, csv] of Object.entries({
    indicator_version: versions,
    upload_batch: 'id,uploaded_by,original_filename\n1,pholio-migration,pholio-migration\n',
  })) {
    await writeFile(join(directory, `${table}.csv.gz`), gzipSync(csv));
  }
  return directory;
}
async function rows(directory: string, table: string) {
  const out = [];
  for await (const row of readGzipCsv(join(directory, `${table}.csv.gz`))) out.push(row);
  return out;
}

it('names the PHOLIO migration user for its writer', () => {
  expect(actorUserId('indicator_version', 'pholio-migration')).toBe(MIGRATED);
});
it.each(['publisher', null])('refuses a writer no user stands for: %s', (actor) => {
  expect(() => actorUserId('upload_batch', actor)).toThrow(
    `upload_batch names a writer with no user: ${actor}`,
  );
});
it('rewrites only the writer columns and returns the new file records', async () => {
  const directory = await fixture(
    'id,name,created_by,updated_by\n1,pholio-migration,pholio-migration,pholio-migration\n',
  );
  const tables = await writeActorsAsUsers(directory, {
    observation: { file: 'observation.csv.gz', rows: 0, bytes: 0, sha256: '0'.repeat(64) },
  });

  expect(await rows(directory, 'indicator_version')).toEqual([
    ['id', 'name', 'created_by', 'updated_by'],
    ['1', 'pholio-migration', MIGRATED, MIGRATED],
  ]);
  expect(await rows(directory, 'upload_batch')).toEqual([
    ['id', 'uploaded_by', 'original_filename'],
    ['1', MIGRATED, 'pholio-migration'],
  ]);
  expect(tables).toEqual({
    observation: { file: 'observation.csv.gz', rows: 0, bytes: 0, sha256: '0'.repeat(64) },
    indicator_version: await fileRecord(
      join(directory, 'indicator_version.csv.gz'),
      'indicator_version.csv.gz',
      1,
    ),
    upload_batch: await fileRecord(
      join(directory, 'upload_batch.csv.gz'),
      'upload_batch.csv.gz',
      1,
    ),
  });
});
it('refuses a file naming a writer no user stands for', async () => {
  const directory = await fixture('id,created_by,updated_by\n1,pholio-migration,publisher\n');
  await expect(writeActorsAsUsers(directory, {})).rejects.toThrow(
    'indicator_version names a writer with no user: publisher',
  );
});

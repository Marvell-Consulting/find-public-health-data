import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, expect, it } from 'vitest';
import { readGzipCsv } from './csv.ts';
import { fileRecord } from './files.ts';
import { tidyReferenceNames } from './reference-names.ts';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
async function fixture(extra: Record<string, string> = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'reference-names-'));
  directories.push(directory);
  const tables: Record<string, unknown> = {};
  for (const [table, csv] of Object.entries({
    dimension_type: 'id,name,dimension_class,is_required\n1," Sex  ",core,f\n',
    dimension_value: 'id,dimension_type_id,parent_id,name\n1,1,,"  Female\t people  "\n',
    note_type: 'id,text,category\n1,"  Suppressed\u00a0  value ",disclosure\n',
    ...extra,
  })) {
    const file = `${table}.csv.gz`;
    await writeFile(join(directory, file), gzipSync(csv));
    tables[table] = await fileRecord(join(directory, file), file, 1);
  }
  await writeFile(join(directory, 'source-manifest.json'), JSON.stringify({ tables }));
  return directory;
}
async function rows(directory: string, table: string) {
  const out = [];
  for await (const row of readGzipCsv(join(directory, `${table}.csv.gz`))) out.push(row);
  return out;
}
it('tidies names with the service rule, preserves NULLs and stamps verified file hashes', async () => {
  const directory = await fixture();
  await tidyReferenceNames(directory);
  expect((await rows(directory, 'dimension_value'))[1]?.slice(2)).toEqual([
    '__FPHD_NULL_5f92c66de4b849b4a717c23f5cbdb8a1__',
    'Female people',
  ]);
  expect((await rows(directory, 'note_type'))[1]?.[1]).toBe('Suppressed value');
  const manifest = JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8'));
  expect(manifest.reference_names).toBe('tidied');
  for (const table of ['dimension_type', 'dimension_value', 'note_type'])
    expect(manifest.tables[table]).toEqual(
      await fileRecord(join(directory, `${table}.csv.gz`), `${table}.csv.gz`, 1),
    );
});
it.each([
  ['dimension_type', 'id,name\n1,Sex\n2," Sex "\n'],
  ['dimension_value', 'id,dimension_type_id,name\n1,1,Female\n2,1," Female "\n'],
  ['note_type', 'id,text,category\n1,Suppressed,disclosure\n2," Suppressed ",contextual\n'],
])('refuses ambiguous %s names before modifying any file', async (table, csv) => {
  const directory = await fixture({ [table]: csv });
  const before = await readFile(join(directory, 'dimension_type.csv.gz'));
  await expect(tidyReferenceNames(directory)).rejects.toThrow(new RegExp(`${table} ids 1, 2`));
  expect(await readFile(join(directory, 'dimension_type.csv.gz'))).toEqual(before);
  expect(
    JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8')).reference_names,
  ).toBeUndefined();
});
it('leaves committed reference data unchanged at the CSV level', async () => {
  const directory = await fixture();
  for (const table of ['dimension_type', 'dimension_value', 'note_type'])
    await copyFile(
      new URL(`../../../packages/db/data/seed/${table}.csv.gz`, import.meta.url),
      join(directory, `${table}.csv.gz`),
    );
  const before = await Promise.all(
    ['dimension_type', 'dimension_value', 'note_type'].map((table) => rows(directory, table)),
  );
  await tidyReferenceNames(directory);
  const after = await Promise.all(
    ['dimension_type', 'dimension_value', 'note_type'].map((table) => rows(directory, table)),
  );
  expect(after).toEqual(before);
});

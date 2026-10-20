import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { readCsvHeader } from '@fphd/db-operations';
import { afterEach, describe, expect, it } from 'vitest';

import { encodeRow, readGzipCsv, transformGzipCsv } from './csv.ts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('transformGzipCsv', () => {
  it('preserves quoted multiline values across output batches and their final remainder', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'batched-csv-'));
    directories.push(directory);
    const path = join(directory, 'notes.csv.gz');
    const expected = [
      ['id', 'text'],
      ...Array.from({ length: 5001 }, (_, index) => [
        String(index + 1),
        `Quoted "note", café\n${index}`,
      ]),
    ];
    await writeFile(path, gzipSync(expected.map((row) => encodeRow(row, true)).join('')));
    expect(await transformGzipCsv(path, (row) => row)).toBe(5001);
    const actual = [];
    for await (const row of readGzipCsv(path)) actual.push(row);
    expect(actual).toEqual(expected);
  });

  it('writes a header the seed importer reads as bare column names', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'transform-csv-'));
    directories.push(directory);
    const path = join(directory, 'indicator_version.csv.gz');
    await writeFile(path, gzipSync('id,name\n1,"Under 75, mortality"\n'));

    const rows = await transformGzipCsv(
      path,
      (row) => [...row, 'under-75-mortality'],
      (header) => [...header, 'slug'],
    );

    expect(rows).toBe(1);
    expect(await readCsvHeader(path)).toEqual(['id', 'name', 'slug']);
    expect(gunzipSync(await readFile(path)).toString()).toBe(
      '"id","name","slug"\r\n"1","Under 75, mortality","under-75-mortality"\r\n',
    );
  });
});

it('preserves SQL NULL separately from quoted empty strings on a prepared CSV round trip', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'csv-null-'));
  directories.push(directory);
  const path = join(directory, 'data_source.csv.gz');
  await writeFile(path, gzipSync('id,name,url\r\n"one","Name",\r\n"two","Name",""\r\n'));
  const rows = [];
  for await (const row of readGzipCsv(path)) rows.push(encodeRow(row, true));
  expect(rows.slice(1)).toEqual(['"one","Name",\r\n', '"two","Name",""\r\n']);
});

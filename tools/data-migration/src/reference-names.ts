import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { tidyName } from '@fphd/utils/tidy-name';

import { readGzipCsv, transformGzipCsv } from './csv.ts';
import { fileRecord } from './files.ts';

const nameColumns = {
  dimension_type: 'name',
  dimension_value: 'name',
  note_type: 'text',
} as const;

/** Refuses ambiguous names before rewriting any reference table. */
export async function tidyReferenceNames(directory: string): Promise<void> {
  for (const [table, column] of Object.entries(nameColumns)) {
    let header: string[] | undefined;
    const names = new Map<string, string>();
    for await (const row of readGzipCsv(join(directory, `${table}.csv.gz`))) {
      if (!header) {
        header = row;
        continue;
      }
      const index = header.indexOf(column);
      if (index === -1) throw new Error(`${table} has no ${column} column`);
      const name = tidyName(row[index] ?? '');
      const id = row[header.indexOf('id')] ?? '';
      const scope = table === 'dimension_value' ? row[header.indexOf('dimension_type_id')] : '';
      const key = JSON.stringify([scope, name]);
      const previous = names.get(key);
      if (previous !== undefined)
        throw new Error(
          `${table} ids ${previous}, ${id} have the same tidied ${column}: ${JSON.stringify(name)}; resolve the source names before preparing`,
        );
      names.set(key, id);
    }
  }
  const path = join(directory, 'source-manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  for (const [table, column] of Object.entries(nameColumns)) {
    const file = `${table}.csv.gz`;
    const rows = await transformGzipCsv(join(directory, file), (row, header) =>
      row.map((value, index) => (header[index] === column ? tidyName(value) : value)),
    );
    manifest.tables[table] = await fileRecord(join(directory, file), file, rows);
  }
  manifest.reference_names = 'tidied';
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

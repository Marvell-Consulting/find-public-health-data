import { createReadStream, createWriteStream } from 'node:fs';
import { rename } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';

import { DATA_MIGRATION_NULL } from '@fphd/db/data-migration-contract';
import { parse } from 'csv-parse';

export function encodeRow(row: readonly (string | number)[], final = false): string {
  return `${row
    .map((value) => {
      const text = String(value);
      if (text === DATA_MIGRATION_NULL) return final ? '' : DATA_MIGRATION_NULL;
      return `"${text.replaceAll('"', '""')}"`;
    })
    .join(',')}\r\n`;
}

export async function transformGzipCsv(
  path: string,
  transformRow: (
    row: string[],
    header: readonly string[],
  ) => readonly (string | number)[] | undefined,
  transformHeader: (header: string[]) => string[] = (header) => header,
): Promise<number> {
  const temporary = `${path}.tmp`;
  let header: string[] | undefined;
  let rows = 0;
  const pending: string[] = [];
  let pendingLength = 0;
  const output = new Transform({
    writableObjectMode: true,
    transform(record: string[], _encoding, callback) {
      try {
        if (header === undefined) {
          header = record;
          // Both migration readers accept quoted CSV headers.
          callback(null, encodeRow(transformHeader(record)));
          return;
        }
        const transformed = transformRow(record, header);
        if (transformed === undefined) {
          callback(null);
          return;
        }
        rows += 1;
        const encoded = encodeRow(transformed, true);
        pending.push(encoded);
        pendingLength += encoded.length;
        // Batch CSV text to avoid a separate compression request for every row.
        if (pendingLength >= 64 * 1024) {
          const chunk = pending.join('');
          pending.length = 0;
          pendingLength = 0;
          callback(null, chunk);
        } else callback(null);
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback) {
      callback(null, pending.length > 0 ? pending.join('') : undefined);
    },
  });
  await pipeline(
    createReadStream(path),
    createGunzip(),
    parse({
      cast: (value, context) => (!context.quoting && value === '' ? DATA_MIGRATION_NULL : value),
    }),
    output,
    createGzip({ level: 1 }),
    createWriteStream(temporary),
  );
  await rename(temporary, path);
  return rows;
}

export async function* readGzipCsv(path: string): AsyncGenerator<string[]> {
  const records = createReadStream(path)
    .pipe(createGunzip())
    .pipe(
      parse({
        cast(value, context) {
          return !context.header && !context.quoting && value === '' ? DATA_MIGRATION_NULL : value;
        },
      }),
    );
  for await (const record of records) yield record as string[];
}

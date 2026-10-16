import { pipeline, type Readable } from 'node:stream';

import { CsvError, type Info, parse } from 'csv-parse';

import { type Header, readHeader } from './data-table-columns.ts';
import type { DataTableFinding } from './data-table-problems.ts';
import { type DataTableReferences, type DataTableRow, readRow } from './data-table-rows.ts';

/** What reading a data table finds, in file order. */
export type DataTableEvent =
  | { kind: 'columns'; names: string[] }
  | { kind: 'row'; row: DataTableRow }
  | { kind: 'finding'; finding: DataTableFinding };

// Bounds the memory one record can take, such as an unclosed quote swallowing the rest of the file.
const MAX_RECORD_CHARACTERS = 100_000;

const parseOptions = {
  bom: true,
  info: true,
  max_record_size: MAX_RECORD_CHARACTERS,
  // Either line ending throughout; the parser would otherwise take the first one it meets.
  record_delimiter: ['\r\n', '\n'],
  relax_column_count: true,
  skip_empty_lines: true,
  // A row of empty cells, as spreadsheets save below the data, is a blank line too.
  skip_records_with_empty_values: true,
  trim: true,
};

/**
 * Reads a CSV data table as a stream, so a file of any length is held a record at a time: its
 * headings and what is wrong with them, then each row as it is loaded or what is wrong with
 * it. A file that is not CSV yields one `unreadable` finding; a failure of the stream itself
 * is thrown.
 */
export async function* readDataTable(
  file: Readable,
  references: DataTableReferences,
): AsyncGenerator<DataTableEvent> {
  // pipeline, so a failing file fails the parser and a parser left early stops the file.
  const records = pipeline(file, parse(parseOptions), () => {});
  let header: Header | undefined;
  let rowCount = 0;

  try {
    for await (const { record, info } of records as AsyncIterable<{
      record: string[];
      info: Info;
    }>) {
      if (header === undefined) {
        yield { kind: 'columns', names: record };
        header = readHeader(record);
        for (const finding of header.findings) yield { kind: 'finding', finding };
        continue;
      }

      rowCount += 1;
      const reading = readRow(record, header, references, info.lines);
      if (reading.ok) {
        yield { kind: 'row', row: reading.row };
      } else {
        for (const finding of reading.findings) yield { kind: 'finding', finding };
      }
    }
  } catch (error) {
    if (!(error instanceof CsvError)) throw error;
    yield { kind: 'finding', finding: { code: 'unreadable' } };
    return;
  }

  if (rowCount === 0) yield { kind: 'finding', finding: { code: 'no_rows' } };
}

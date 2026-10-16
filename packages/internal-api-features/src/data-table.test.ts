import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';
import { ENGLAND, LEEDS, references } from './data-table.testing.ts';
import { type DataTableEvent, readDataTable } from './data-table.ts';

async function events(content: string | Buffer): Promise<DataTableEvent[]> {
  const found: DataTableEvent[] = [];
  for await (const event of readDataTable(Readable.from([Buffer.from(content)]), references)) {
    found.push(event);
  }
  return found;
}

function rowsOf(found: DataTableEvent[]) {
  return found.flatMap((event) => (event.kind === 'row' ? [event.row] : []));
}

function findingsOf(found: DataTableEvent[]) {
  return found.flatMap((event) => (event.kind === 'finding' ? [event.finding] : []));
}

const HEADER = 'area_code,period_start,period_end,value';

describe('readDataTable', () => {
  it('gives the headings, then each row numbered by its line in the file', async () => {
    const found = await events(
      `${HEADER}\nE92000001,2019-04-01,2020-03-31,83.8\nE08000035,2019-04-01,2020-03-31,81.2\n`,
    );

    expect(found[0]).toEqual({
      kind: 'columns',
      names: ['area_code', 'period_start', 'period_end', 'value'],
    });
    expect(rowsOf(found).map(({ line, areaId, value }) => ({ line, areaId, value }))).toEqual([
      { line: 2, areaId: ENGLAND, value: '83.8' },
      { line: 3, areaId: LEEDS, value: '81.2' },
    ]);
    expect(findingsOf(found)).toEqual([]);
  });

  it('reads Windows line endings, a byte order mark and quoted cells', async () => {
    const found = await events(
      `﻿${HEADER},value_note\r\n"E92000001",2019-04-01,2020-03-31,"83.8"," Value suppressed for disclosure control "\r\n`,
    );

    expect(findingsOf(found)).toEqual([]);
    expect(rowsOf(found)).toHaveLength(1);
  });

  it('skips blank lines and rows of empty cells, counting them in the line numbers', async () => {
    const found = await events(
      `${HEADER}\n\nE92000001,2019-04-01,2020-03-31,83.8\n , , ,\nE99999999,2019-04-01,2020-03-31,1\n`,
    );

    expect(rowsOf(found)).toHaveLength(1);
    expect(findingsOf(found)).toEqual([{ code: 'unmatched_area_codes', item: 'E99999999' }]);
  });

  it('numbers rows after a cell spanning lines by the line the row ends on', async () => {
    const found = await events(
      `${HEADER},value_note\nE92000001,2019-04-01,2020-03-31,1,"two\nlines"\nE92000001,2019,2020,2,\n`,
    );

    expect(findingsOf(found)).toContainEqual({ code: 'invalid_periods', item: '4' });
  });

  it('reads the rows of a file whose headings are refused for what else they show', async () => {
    const found = await events('area_code,period_start,value\nE99999999,2019-04-01,83.8\n');

    expect(rowsOf(found)).toEqual([]);
    expect(findingsOf(found)).toEqual([
      { code: 'missing_column', item: 'period_end' },
      { code: 'unmatched_area_codes', item: 'E99999999' },
    ]);
  });

  it('finds no rows in a file of headings alone', async () => {
    expect(findingsOf(await events(`${HEADER}\n`))).toEqual([{ code: 'no_rows' }]);
  });

  it('finds no rows in a file of blank lines', async () => {
    expect(findingsOf(await events('\n\n'))).toEqual([{ code: 'no_rows' }]);
  });

  it('cannot read a file whose quote is never closed', async () => {
    const found = await events(`${HEADER}\nE92000001,2019-04-01,2020-03-31,"83.8\n`);

    expect(findingsOf(found)).toEqual([{ code: 'unreadable' }]);
  });

  it('cannot read a record longer than any data table row', async () => {
    const found = await events(`${HEADER}\n"${'x'.repeat(200_000)}",2019-04-01,2020-03-31,1\n`);

    expect(findingsOf(found)).toEqual([{ code: 'unreadable' }]);
  });

  it('throws when the file itself fails', async () => {
    const failure = new Error('connection reset');
    const file = new Readable({
      read() {
        this.push(`${HEADER}\n`);
        this.destroy(failure);
      },
    });

    await expect(async () => {
      for await (const _event of readDataTable(file, references)) {
        // read to the end
      }
    }).rejects.toBe(failure);
  });
});

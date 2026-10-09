import { tidyName } from '@fphd/utils/tidy-name';

import type { ColumnPositions, DataTableColumn } from './data-table-columns.ts';
import type { DataTableFinding } from './data-table-problems.ts';

/** The reference data a row's names and codes are matched to, keyed by tidied name or code. */
export interface DataTableReferences {
  /** The current area for each code. */
  areaIds: ReadonlyMap<string, string>;
  sexIds: ReadonlyMap<string, string>;
  ageIds: ReadonlyMap<string, string>;
  /** Every dimension type but sex and age, which have columns of their own, to its values. */
  categoryIds: ReadonlyMap<string, ReadonlyMap<string, string>>;
  noteTypeIds: ReadonlyMap<string, string>;
}

const NUMBER_COLUMNS = [
  'value',
  'count',
  'denominator',
  'lower_ci_95',
  'upper_ci_95',
  'lower_ci_998',
  'upper_ci_998',
] as const satisfies readonly DataTableColumn[];

type NumberColumn = (typeof NUMBER_COLUMNS)[number];

/** A row as it is loaded: ids for what it names, and its numbers as written, null when empty. */
export type DataTableRow = Record<NumberColumn, string | null> & {
  /** The file's line number, which a spreadsheet shows as the row number. */
  line: number;
  areaId: string;
  fromDate: string;
  toDate: string;
  sexId: string | null;
  ageId: string | null;
  categoryId: string | null;
  noteTypeId: string | null;
};

export type RowReading =
  | { ok: true; row: DataTableRow }
  | { ok: false; findings: DataTableFinding[] };

// These mark a total, which is stored without the dimension, as an empty cell is.
const ALL_SEXES = 'Persons';
const ALL_AGES = 'All ages';

const NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Digits with an optional minus sign, decimal part and exponent, and finite once read. */
export function isNumber(text: string): boolean {
  return NUMBER.test(text) && Number.isFinite(Number(text));
}

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
  const parts = ISO_DATE.exec(text);
  if (parts === null) return false;

  const [year, month, day] = parts.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Both ends of a period, inclusive, so one that ends the day it starts is a day long. */
function isPeriod(start: string, end: string): boolean {
  return isIsoDate(start) && isIsoDate(end) && start <= end;
}

type Lookup<T> = { found: true; value: T } | { found: false };

/** A name that is empty or marks the total stands for no dimension value. */
function lookUpName(
  name: string,
  ids: ReadonlyMap<string, string> | undefined,
  total?: string,
): Lookup<string | null> {
  if (name === '' || name === total) return { found: true, value: null };
  const id = ids?.get(name);
  return id === undefined ? { found: false } : { found: true, value: id };
}

/**
 * Reads one row of a data table whose header has already been accepted: either the row as it
 * is loaded, or everything wrong with it. Every cell is trimmed, and names are tidied to match.
 */
export function readRow(
  cells: readonly string[],
  positions: ColumnPositions,
  references: DataTableReferences,
  line: number,
): RowReading {
  const row = String(line);

  if (cells.length !== Object.keys(positions).length) {
    return { ok: false, findings: [{ code: 'wrong_cell_count', item: row }] };
  }

  const cell = (column: DataTableColumn): string => {
    const position = positions[column];
    return position === undefined ? '' : (cells[position] ?? '').trim();
  };
  const findings: DataTableFinding[] = [];

  const areaCode = cell('area_code');
  const fromDate = cell('period_start');
  const toDate = cell('period_end');
  const areaId = references.areaIds.get(areaCode);

  if (areaCode === '' || fromDate === '' || toDate === '') {
    findings.push({ code: 'missing_cells', item: row });
  } else {
    if (areaId === undefined) findings.push({ code: 'unmatched_area_codes', item: areaCode });
    if (!isPeriod(fromDate, toDate)) findings.push({ code: 'invalid_periods', item: row });
  }

  const numbers = Object.fromEntries(
    NUMBER_COLUMNS.map((column) => [column, cell(column) === '' ? null : cell(column)]),
  ) as Record<NumberColumn, string | null>;

  if (Object.values(numbers).some((number) => number !== null && !isNumber(number))) {
    findings.push({ code: 'invalid_numbers', item: row });
  }

  const sexName = tidyName(cell('sex'));
  const sex = lookUpName(sexName, references.sexIds, ALL_SEXES);
  if (!sex.found) findings.push({ code: 'unmatched_sexes', item: sexName });

  const ageName = tidyName(cell('age'));
  const age = lookUpName(ageName, references.ageIds, ALL_AGES);
  if (!age.found) findings.push({ code: 'unmatched_ages', item: ageName });

  const categoryType = tidyName(cell('category_type'));
  const categoryName = tidyName(cell('category'));
  const category =
    (categoryType === '') === (categoryName === '')
      ? lookUpName(categoryName, references.categoryIds.get(categoryType))
      : undefined;
  if (category === undefined) {
    findings.push({ code: 'unpaired_category', item: row });
  } else if (!category.found) {
    findings.push({ code: 'unmatched_categories', item: `${categoryType}: ${categoryName}` });
  }

  const noteName = tidyName(cell('value_note'));
  const note = lookUpName(noteName, references.noteTypeIds);
  if (!note.found) findings.push({ code: 'unmatched_value_notes', item: noteName });

  if (
    findings.length > 0 ||
    areaId === undefined ||
    !sex.found ||
    !age.found ||
    category === undefined ||
    !category.found ||
    !note.found
  ) {
    return { ok: false, findings };
  }

  return {
    ok: true,
    row: {
      line,
      areaId,
      fromDate,
      toDate,
      ...numbers,
      sexId: sex.value,
      ageId: age.value,
      categoryId: category.value,
      noteTypeId: note.value,
    },
  };
}

import type { DataTableFinding } from './data-table-problems.ts';

/** Every column a data table may have, each under one heading. */
export const DATA_TABLE_COLUMNS = [
  'area_code',
  'period_start',
  'period_end',
  'value',
  'count',
  'denominator',
  'lower_ci_95',
  'upper_ci_95',
  'lower_ci_998',
  'upper_ci_998',
  'sex',
  'age',
  'category_type',
  'category',
  'value_note',
] as const;

export type DataTableColumn = (typeof DATA_TABLE_COLUMNS)[number];

const REQUIRED_COLUMNS: readonly DataTableColumn[] = [
  'area_code',
  'period_start',
  'period_end',
  'value',
];

/** Where each column is in a row, for the columns the table has. */
export type ColumnPositions = Partial<Record<DataTableColumn, number>>;

export type HeaderReading =
  | { ok: true; positions: ColumnPositions }
  | { ok: false; findings: DataTableFinding[] };

function isColumn(heading: string): heading is DataTableColumn {
  return (DATA_TABLE_COLUMNS as readonly string[]).includes(heading);
}

/** Headings match whatever their case and surrounding spaces; anything unknown refuses the file. */
export function readHeader(cells: readonly string[]): HeaderReading {
  const headings = cells.map((cell) => cell.trim().toLowerCase());
  const recognised = headings.filter(isColumn);
  const repeated = recognised.filter((heading, index) => recognised.indexOf(heading) !== index);

  const findings: DataTableFinding[] = [
    ...REQUIRED_COLUMNS.filter((column) => !recognised.includes(column)).map((column) => ({
      code: 'missing_column' as const,
      item: column,
    })),
    ...headings
      .filter((heading) => !isColumn(heading))
      .map((heading) => ({ code: 'unrecognised_columns' as const, item: heading })),
    ...[...new Set(repeated)].map((heading) => ({
      code: 'repeated_columns' as const,
      item: heading,
    })),
    ...(recognised.includes('category_type') === recognised.includes('category')
      ? []
      : [{ code: 'unpaired_category' as const }]),
  ];

  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    positions: Object.fromEntries(headings.map((column, index) => [column, index])),
  };
}

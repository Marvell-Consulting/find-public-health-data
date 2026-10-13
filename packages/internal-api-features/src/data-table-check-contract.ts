import { z } from '@fphd/config/zod';
import { YEAR_TYPES } from '@fphd/utils/period-type';

import { DATA_TABLE_COLUMNS } from './data-table-columns.ts';

export type { DataTableColumn } from './data-table-columns.ts';

/** The numbers of rows a page of the data table can show; the first is the default. */
export const DATA_TABLE_ROWS_PER_PAGE = ['10', '25', '50'] as const;

/** Parsed from a query string, so both arrive as text; absent means the first page of 10. */
export const dataTablePageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  rowsPerPage: z.enum(DATA_TABLE_ROWS_PER_PAGE).default('10').transform(Number),
});

const number = z.number().nullable();

/** One loaded row, its references read back as the names and codes the file gave. */
export const dataTableRowSchema = z.object({
  areaCode: z.string(),
  fromDate: z.iso.date(),
  toDate: z.iso.date(),
  /** With the area and dates, the row's natural key: unique in its batch. */
  dimensionKey: z.string(),
  value: number,
  count: number,
  denominator: number,
  lowerCi95: number,
  upperCi95: number,
  lowerCi998: number,
  upperCi998: number,
  sex: z.string().nullable(),
  age: z.string().nullable(),
  categoryType: z.string().nullable(),
  category: z.string().nullable(),
  valueNotes: z.array(z.string()),
});

/**
 * A page of the batch the draft points at, or null before a file has loaded: the file's columns,
 * its row count, and the page's rows. The batch id is what a confirmation names, and the year type
 * is the draft's, for labelling the periods.
 */
export const dataTableCheckSchema = z.object({
  dataTable: z
    .object({
      batchId: z.uuid(),
      columns: z.array(z.enum(DATA_TABLE_COLUMNS)),
      rowCount: z.number().int().min(0),
      yearType: z.object({ value: z.enum(YEAR_TYPES), label: z.string().min(1) }).nullable(),
      page: z.number().int().min(1),
      rowsPerPage: z.number().int().min(1),
      rows: z.array(dataTableRowSchema),
    })
    .nullable(),
});

/** Confirms the batch the check page showed, which must still be the draft's. */
export const dataTableConfirmationSchema = z.object({ batchId: z.uuid() });

export const dataTableConfirmedSchema = z.object({ confirmedAt: z.iso.datetime() });

export const dataTableConfirmationErrorSchema = z.object({
  error: z.enum(['invalid_id', 'validation_failed', 'data_table_changed']),
});

export type DataTablePageQuery = z.infer<typeof dataTablePageQuerySchema>;
export type DataTableRow = z.infer<typeof dataTableRowSchema>;
export type DataTableCheck = z.infer<typeof dataTableCheckSchema>;
export type DataTableConfirmation = z.infer<typeof dataTableConfirmationSchema>;
export type DataTableConfirmed = z.infer<typeof dataTableConfirmedSchema>;
export type DataTableConfirmationError = z.infer<typeof dataTableConfirmationErrorSchema>;

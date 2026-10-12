import { z } from '@fphd/config/zod';

/** The largest data table accepted, in decimal megabytes as the platform's upload limit is set. */
export const DATA_TABLE_MAX_BYTES = 100_000_000;

/** The form field the data table is sent in. */
export const dataUploadFieldSchema = z.enum(['dataTable']);

export const DATA_TABLE_MESSAGES = {
  missing: 'Select a data table',
  notCsv: 'The selected file must be a CSV',
  empty: 'The selected file is empty',
  tooLarge: 'The selected file must be smaller than 100MB',
} as const;

/** What can be wrong with a data table's content, in the order the problems page lists them. */
export const DATA_TABLE_PROBLEM_CODES = [
  'unreadable',
  'missing_column',
  'unrecognised_columns',
  'repeated_columns',
  'unpaired_category',
  'no_rows',
  'wrong_cell_count',
  'missing_cells',
  'unmatched_area_codes',
  'invalid_periods',
  'unmatched_sexes',
  'unmatched_ages',
  'unmatched_categories',
  'unmatched_value_notes',
  'ambiguous_names',
  'invalid_numbers',
  'duplicate_rows',
] as const;

export const dataTableProblemCodeSchema = z.enum(DATA_TABLE_PROBLEM_CODES);

/** The most examples a problem carries; its count says how many there are in all. */
export const DATA_TABLE_PROBLEM_ITEMS = 10;

/**
 * One problem with the examples found: row numbers for the row problems, column headings for the
 * column problems, and the values themselves where they match no reference data.
 */
export const dataTableProblemSchema = z.object({
  code: dataTableProblemCodeSchema,
  items: z.array(z.string()).max(DATA_TABLE_PROBLEM_ITEMS),
  count: z.number().int().min(0),
});

/** The batch a data table was loaded into, and how many rows it holds. */
export const dataUploadCreatedSchema = z.object({
  id: z.uuid(),
  rowCount: z.number().int().min(0),
});

/**
 * The 400 and 422 answers: a file the form refuses outright names the field, and a file whose
 * content was refused names the batch keeping it and its problems.
 */
export const dataUploadErrorSchema = z.discriminatedUnion('error', [
  z.object({ error: z.literal('invalid_id') }),
  z.object({
    error: z.literal('validation_failed'),
    fieldErrors: z.partialRecord(dataUploadFieldSchema, z.string()),
  }),
  z.object({
    error: z.literal('invalid_data_table'),
    id: z.uuid(),
    problems: z.array(dataTableProblemSchema).min(1),
  }),
]);

/** The draft's most recent upload, which the problems page shows while it is a failed one. */
export const dataUploadLatestSchema = z.object({
  latestUpload: z
    .object({
      id: z.uuid(),
      status: z.enum(['processed', 'failed']),
      originalFilename: z.string(),
      uploadedAt: z.iso.datetime(),
      problems: z.array(dataTableProblemSchema),
    })
    .nullable(),
});

export type DataUploadField = z.infer<typeof dataUploadFieldSchema>;
export type DataTableProblemCode = z.infer<typeof dataTableProblemCodeSchema>;
export type DataTableProblem = z.infer<typeof dataTableProblemSchema>;
export type DataUploadCreated = z.infer<typeof dataUploadCreatedSchema>;
export type DataUploadError = z.infer<typeof dataUploadErrorSchema>;
export type DataUploadLatest = z.infer<typeof dataUploadLatestSchema>;

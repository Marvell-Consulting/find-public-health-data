import type { DataTableProblemCode } from '@fphd/internal-api-features/contract';
import type { ReactNode } from 'react';

import type { DataTableProblem } from './loader.ts';

/** One row of the problems table. */
export interface ProblemRow {
  problem: string;
  detail: ReactNode;
  actions: readonly string[];
}

const CHECK_FILE = 'check you uploaded the correct data table';
const FIX_FILE = 'fix the data table and re-upload it';
const FIX_ACTIONS = [CHECK_FILE, FIX_FILE];

function unmatchedActions(what: string) {
  return [CHECK_FILE, `check the reference data ${what} you intended`, FIX_FILE];
}

/** "There is 1 row" or "There are 3 rows". */
function thereAre(count: number, singular: string, plural: string): string {
  return count === 1
    ? `There is 1 ${singular}`
    : `There are ${count.toLocaleString('en-GB')} ${plural}`;
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="govuk-list govuk-list--bullet">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** A lead sentence and the examples, which say "including" when they are not all of them. */
function Examples({
  lead,
  problem,
  format = (item) => item,
}: {
  lead: string;
  problem: DataTableProblem;
  format?: (item: string) => string;
}) {
  const partial = problem.items.length < problem.count;

  return (
    <>
      <p className="govuk-body">{`${lead}${partial ? ', including' : ''}:`}</p>
      <BulletList items={problem.items.map(format)} />
    </>
  );
}

const row = (item: string) => `row ${item}`;
const heading = (item: string) => (item === '' ? '(no heading)' : item);

interface Content {
  problem: string;
  detail: (problem: DataTableProblem) => ReactNode;
  actions: readonly string[];
}

function rowsContent(problem: string, what: string): Content {
  return {
    problem,
    detail: (found) => (
      <Examples
        lead={`${thereAre(found.count, 'row', 'rows')} in your data table ${what}`}
        problem={found}
        format={row}
      />
    ),
    actions: FIX_ACTIONS,
  };
}

function unmatchedContent(problem: string, singular: string, plural: string, what: string) {
  return {
    problem,
    detail: (found: DataTableProblem) => (
      <Examples
        lead={`${thereAre(found.count, `instance of ${singular}`, `instances of ${plural}`)} in your data table that could not be matched to the reference data`}
        problem={found}
      />
    ),
    actions: unmatchedActions(what),
  };
}

const CONTENT: Record<Exclude<DataTableProblemCode, 'missing_column'>, Content> = {
  unreadable: {
    problem: 'Data table could not be read',
    detail: () => (
      <p className="govuk-body">
        The data table could not be read as a CSV (comma-separated values) file.
      </p>
    ),
    actions: [CHECK_FILE, 'save the data table as a CSV file and re-upload it'],
  },
  unrecognised_columns: {
    problem: 'Columns not recognised',
    detail: (found) => (
      <Examples
        lead={`${thereAre(found.count, 'column', 'columns')} in your data table with a heading that is not recognised`}
        problem={found}
        format={heading}
      />
    ),
    actions: FIX_ACTIONS,
  },
  repeated_columns: {
    problem: 'Columns repeated',
    detail: (found) => (
      <Examples
        lead={`${thereAre(found.count, 'column heading', 'column headings')} used more than once in your data table`}
        problem={found}
      />
    ),
    actions: FIX_ACTIONS,
  },
  unpaired_category: {
    problem: 'category_type and category must be used together',
    detail: (found) =>
      found.items.length === 0 ? (
        <p className="govuk-body">
          Your data table has a category_type column without a category column, or a category column
          without a category_type column.
        </p>
      ) : (
        <Examples
          lead={`${thereAre(found.count, 'row', 'rows')} in your data table with a category_type and no category, or a category and no category_type`}
          problem={found}
          format={row}
        />
      ),
    actions: FIX_ACTIONS,
  },
  no_rows: {
    problem: 'Data table has no rows',
    detail: () => (
      <p className="govuk-body">Your data table has column headings but no rows of data.</p>
    ),
    actions: FIX_ACTIONS,
  },
  wrong_cell_count: rowsContent(
    'Rows with the wrong number of cells',
    'with more or fewer cells than there are columns',
  ),
  missing_cells: rowsContent(
    'Rows missing an area code or period',
    'without an area_code, period_start or period_end',
  ),
  unmatched_area_codes: unmatchedContent(
    'Area codes could not be matched to reference data',
    'an area code',
    'area codes',
    'codes',
  ),
  invalid_periods: rowsContent(
    'Periods could not be read',
    'where period_start or period_end is not a date written as YYYY-MM-DD, or period_end is before period_start',
  ),
  unmatched_sexes: unmatchedContent(
    'Sex values could not be matched to reference data',
    'a sex value',
    'sex values',
    'names',
  ),
  unmatched_ages: unmatchedContent(
    'Ages could not be matched to reference data',
    'an age',
    'ages',
    'names',
  ),
  unmatched_categories: unmatchedContent(
    'Categories could not be matched to reference data',
    'a category',
    'categories',
    'names',
  ),
  unmatched_value_notes: unmatchedContent(
    'Value notes could not be matched to reference data',
    'a value note',
    'value notes',
    'names',
  ),
  invalid_numbers: rowsContent(
    'Numbers could not be read',
    'with a number that could not be read, such as one with a thousands separator, a unit or words',
  ),
  duplicate_rows: rowsContent(
    'Rows repeated',
    'with the same area code, period, sex, age and category as an earlier row',
  ),
};

/** A missing column is a row of its own, as each is its own fix. */
function missingColumnRows(problem: DataTableProblem): ProblemRow[] {
  return problem.items.map((column) => ({
    problem: `${column} column missing`,
    detail: (
      <>
        <p className="govuk-body">Data table either:</p>
        <BulletList
          items={[
            `does not contain a ${column} column`,
            `has a ${column} column with a non-standard heading`,
          ]}
        />
      </>
    ),
    actions: FIX_ACTIONS,
  }));
}

/** The problems table's rows, in the order the API lists the problems. */
export function problemRows(problems: readonly DataTableProblem[]): ProblemRow[] {
  return problems.flatMap((problem) => {
    if (problem.code === 'missing_column') return missingColumnRows(problem);

    const content = CONTENT[problem.code];
    return [
      {
        problem: content.problem,
        detail: content.detail(problem),
        actions: content.actions,
      },
    ];
  });
}

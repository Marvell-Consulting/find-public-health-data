import { DATA_TABLE_ROWS_PER_PAGE } from '@fphd/internal-api-features/contract';
import {
  Button,
  DocumentTitle,
  ErrorSummary,
  GridColumn,
  GridRow,
  Pagination,
  Select,
  Table,
  TableScrollRegion,
} from '@fphd/ui';

import { indicatorDataTableCheckPath, indicatorDataTablePath } from '../publish-paths.ts';
import { checkColumns, rowsShowing, uploadSummary } from './check-data.ts';
import type { DataTableCheckData } from './check-loader.ts';

export const CHECK_HEADING = 'Check the indicator data table';

interface CheckDataTablePageProps extends DataTableCheckData {
  formError?: string | undefined;
}

export function CheckDataTablePage({
  id,
  dataTable,
  totalPages,
  formError,
}: CheckDataTablePageProps) {
  const { page, rowsPerPage, yearType } = dataTable;
  const columns = checkColumns(dataTable.columns);

  // Plain anchors: the router-aware link would also mark every link to the bare path as current.
  const pageLink = (number: number) => ({
    href: indicatorDataTableCheckPath(id, { page: number, rowsPerPage }),
    forceExternal: true,
    ...(number === page ? { 'aria-current': 'page' as const } : {}),
  });

  return (
    <>
      <DocumentTitle hasErrors={formError !== undefined} pageTitle={CHECK_HEADING} />
      <ErrorSummary errors={[]} formError={formError} />
      <GridRow>
        <GridColumn width="full">
          <h1 className="govuk-heading-xl">{CHECK_HEADING}</h1>
          <div className="fphd-table-controls">
            <p className="govuk-body">{uploadSummary(dataTable)}</p>
            {/* Asks for the first page in the new size, without JavaScript too. */}
            <form className="fphd-table-controls__form" method="get">
              <Select
                defaultValue={String(rowsPerPage)}
                label="Rows per page"
                name="rowsPerPage"
                options={DATA_TABLE_ROWS_PER_PAGE.map((value) => ({ value, label: value }))}
              />
              <Button classModifiers="secondary" type="submit">
                Apply
              </Button>
            </form>
          </div>
          <TableScrollRegion label="Data table">
            <Table
              headings={Object.fromEntries(columns.map(({ key, heading }) => [key, heading]))}
              keys={columns.map(({ key }) => key)}
              data={dataTable.rows.map((row) =>
                Object.fromEntries(
                  columns.map(({ key, cell }, index) => [
                    key,
                    // The first column is a row header, which GOV.UK sets bold; the values
                    // read as plain text, as the design has them.
                    index === 0 ? (
                      <span className="govuk-!-font-weight-regular">{cell(row, yearType)}</span>
                    ) : (
                      cell(row, yearType)
                    ),
                  ]),
                ),
              )}
            />
          </TableScrollRegion>
          <div className="fphd-table-controls">
            <p className="govuk-body">{rowsShowing(dataTable)}</p>
            {totalPages > 1 ? (
              <Pagination
                currentPage={page}
                landmarkLabel="Data table pages"
                links={Array.from({ length: totalPages }, (_, index) => pageLink(index + 1))}
              />
            ) : null}
          </div>
          <p className="govuk-body govuk-!-font-weight-bold">
            By continuing, you confirm the data table is correct.
          </p>
          <form action={indicatorDataTableCheckPath(id)} method="post">
            <input name="batchId" type="hidden" value={dataTable.batchId} />
            <div className="govuk-button-group">
              <Button type="submit">Continue</Button>
              <Button classModifiers="secondary" href={indicatorDataTablePath(id)}>
                Choose a different data table
              </Button>
            </div>
          </form>
        </GridColumn>
      </GridRow>
    </>
  );
}

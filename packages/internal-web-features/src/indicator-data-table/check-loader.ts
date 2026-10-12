// No @fphd/ui imports here, so the loader and the action unit-test without the jsdom the components need.
import {
  dataTableCheckSchema,
  dataTableConfirmationErrorSchema,
  dataTableConfirmedSchema,
  dataTablePageQuerySchema,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { FORM_NOT_SAVED } from '../form-refusal.ts';
import { requireIndicatorId } from '../indicator-id.ts';
import { indicatorDataTablePath, indicatorTaskListPath } from '../publish-paths.ts';
import { queryObject } from '../query-object.ts';

export const DATA_TABLE_CHANGED =
  'The data table was replaced while you were checking it. Check the new data table.';

export interface DataTableCheckRefusal {
  formError: string;
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

/**
 * A page of the draft's loaded data table. Before a file has loaded there is nothing to check,
 * so the publisher is sent to upload one; a page that cannot exist is a 404.
 */
export async function loadDataTableCheck({ context, params, request }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const query = dataTablePageQuerySchema.safeParse(queryObject(new URL(request.url).searchParams));

  if (!query.success) throw notFound();

  const { page, rowsPerPage } = query.data;
  const { dataTable } = await context
    .get(apiContext)
    .get(
      `${apiPath`/api/internal/indicators/${id}/data-table`}?page=${page}&rowsPerPage=${rowsPerPage}`,
      dataTableCheckSchema,
    );

  if (dataTable === null) throw redirect(indicatorDataTablePath(id));

  const totalPages = Math.max(1, Math.ceil(dataTable.rowCount / rowsPerPage));

  if (page > totalPages) throw notFound();

  return { id, dataTable, totalPages };
}

export type DataTableCheckData = Awaited<ReturnType<typeof loadDataTableCheck>>;

/**
 * Confirms the batch the page showed and returns to the task list. Should another upload have
 * replaced it meanwhile, the page shows the new one with a message instead.
 */
export async function confirmDataTable({
  context,
  params,
  request,
}: ActionFunctionArgs): Promise<DataTableCheckRefusal | Response> {
  const id = requireIndicatorId(params);
  const batchId = (await request.formData()).get('batchId');
  const result = await context
    .get(apiContext)
    .put(
      apiPath`/api/internal/indicators/${id}/data-table/confirmation`,
      { batchId: typeof batchId === 'string' ? batchId : '' },
      dataTableConfirmedSchema,
      dataTableConfirmationErrorSchema,
    );

  if (result.ok) return redirect(indicatorTaskListPath(id));

  return {
    formError: result.error.error === 'data_table_changed' ? DATA_TABLE_CHANGED : FORM_NOT_SAVED,
  };
}

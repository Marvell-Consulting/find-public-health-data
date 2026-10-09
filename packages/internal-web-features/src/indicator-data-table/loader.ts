// No @fphd/ui imports here, so the loaders and the action unit-test without the jsdom the components need.
import {
  type DataUploadField,
  dataUploadCreatedSchema,
  dataUploadErrorSchema,
  dataUploadLatestSchema,
  indicatorAdminDetailSchema,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { type FormRefusal, formRefusal } from '../form-refusal.ts';
import { requireIndicatorId } from '../indicator-id.ts';
import {
  indicatorDataTablePath,
  indicatorDataTableProblemsPath,
  indicatorTaskListPath,
} from '../publish-paths.ts';

export type { DataTableProblem } from '@fphd/internal-api-features/contract';

export type DataTableUploadFailure = FormRefusal<DataUploadField>;

/** Only a draft takes a data table, so a published indicator has no upload page. */
export async function loadDataTableUpload({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const indicator = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}`, indicatorAdminDetailSchema);

  if (indicator.draftStatus === null) throw new Response('Not Found', { status: 404 });

  return { id };
}

/**
 * Streams the form to the API unread, which stores, checks and loads the file while the
 * publisher waits. A refused file's problems have a page of their own; a loaded one returns to
 * the task list.
 */
export async function uploadDataTable({
  context,
  params,
  request,
}: ActionFunctionArgs): Promise<DataTableUploadFailure | Response> {
  const id = requireIndicatorId(params);
  const result = await context
    .get(apiContext)
    .postStream(
      apiPath`/api/internal/indicators/${id}/data-uploads`,
      { body: request.body, contentType: request.headers.get('content-type') ?? '' },
      dataUploadCreatedSchema,
      dataUploadErrorSchema,
      request.signal,
    );

  if (result.ok) return redirect(indicatorTaskListPath(id));
  if (result.error.error === 'invalid_data_table') {
    return redirect(indicatorDataTableProblemsPath(id));
  }
  return formRefusal(result.error);
}

/** The problems of the draft's latest upload, while it is a refused one. */
export async function loadDataTableProblems({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const { latestUpload } = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}/data-uploads/latest`, dataUploadLatestSchema);

  // Nothing to show once a later file has loaded, so the publisher is offered the upload again.
  if (latestUpload?.status !== 'failed') throw redirect(indicatorDataTablePath(id));

  return { id, problems: latestUpload.problems };
}

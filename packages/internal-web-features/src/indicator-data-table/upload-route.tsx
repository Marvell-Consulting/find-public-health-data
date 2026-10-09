import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData } from 'react-router';

import { indicatorTaskListPath } from '../publish-paths.ts';
import { type DataTableUploadFailure, loadDataTableUpload, uploadDataTable } from './loader.ts';
import { UploadDataTablePage } from './pages.tsx';

export const loader = loadDataTableUpload;

export const action = uploadDataTable;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorTaskListPath(id),
);

export function UploadDataTableRoute() {
  const refused = useActionData<DataTableUploadFailure | undefined>();

  return <UploadDataTablePage fieldErrors={refused?.fieldErrors} formError={refused?.formError} />;
}

export default UploadDataTableRoute;

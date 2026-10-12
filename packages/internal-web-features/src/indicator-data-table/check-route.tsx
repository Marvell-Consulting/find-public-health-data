import { backLinkHandle, titleFromPage } from '@fphd/ui';
import { useActionData, useLoaderData } from 'react-router';

import { indicatorDataTablePath } from '../publish-paths.ts';
import {
  confirmDataTable,
  type DataTableCheckRefusal,
  loadDataTableCheck,
} from './check-loader.ts';
import { CheckDataTablePage } from './check-page.tsx';

export const loader = loadDataTableCheck;

export const action = confirmDataTable;

export const meta = titleFromPage;

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorDataTablePath(id),
);

export function CheckDataTableRoute() {
  const data = useLoaderData<typeof loader>();
  const refused = useActionData<DataTableCheckRefusal | undefined>();

  return <CheckDataTablePage {...data} formError={refused?.formError} />;
}

export default CheckDataTableRoute;

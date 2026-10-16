import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { indicatorDataTablePath } from '../publish-paths.ts';
import { loadDataTableProblems } from './loader.ts';
import { DataTableProblemsPage, PROBLEMS_HEADING } from './pages.tsx';

export const loader = loadDataTableProblems;

export const meta = createDocumentMeta(PROBLEMS_HEADING);

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ id }) =>
  indicatorDataTablePath(id),
);

export function DataTableProblemsRoute() {
  const { id, problems } = useLoaderData<typeof loader>();

  return <DataTableProblemsPage id={id} problems={problems} />;
}

export default DataTableProblemsRoute;

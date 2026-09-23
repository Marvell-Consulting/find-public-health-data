import { backLinkHandle, createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { indicatorOverviewPath } from '../indicator-overview/paths.ts';
import { loadIndicatorTaskList } from './loader.ts';
import { IndicatorTaskListPage } from './page.tsx';

export const loader = loadIndicatorTaskList;

export const meta = createDocumentMeta('Indicator task list');

export const handle = backLinkHandle<Awaited<ReturnType<typeof loader>>>(({ taskList }) =>
  indicatorOverviewPath(taskList.indicator.id),
);

export function IndicatorTaskListRoute() {
  const { taskList } = useLoaderData<typeof loader>();
  return <IndicatorTaskListPage taskList={taskList} />;
}

export default IndicatorTaskListRoute;

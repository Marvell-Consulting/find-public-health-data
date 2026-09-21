import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';
import { loadIndicatorTaskList } from './loader.ts';
import { IndicatorTaskListPage } from './page.tsx';

export const loader = loadIndicatorTaskList;

export const meta = createDocumentMeta('Indicator task list');

export function IndicatorTaskListRoute() {
  const { taskList } = useLoaderData<typeof loader>();
  return <IndicatorTaskListPage taskList={taskList} />;
}

export default IndicatorTaskListRoute;

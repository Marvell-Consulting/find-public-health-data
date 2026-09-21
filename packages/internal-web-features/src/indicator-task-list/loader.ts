// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import { indicatorIdSchema, indicatorTaskListSchema } from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

export type {
  IndicatorTaskList,
  IndicatorTaskStatus,
  IndicatorTaskStatuses,
} from '@fphd/internal-api-features/contract';

/**
 * The whole page in one call. An address that is not an id names nothing, and the API answers
 * 404 for an indicator that is missing or has no draft, which the not-found boundary renders.
 */
export async function loadIndicatorTaskList({ context, params }: LoaderFunctionArgs) {
  const id = indicatorIdSchema.safeParse(params.id);

  if (!id.success) throw new Response('Not Found', { status: 404 });

  const taskList = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id.data}/task-list`, indicatorTaskListSchema);

  return { taskList };
}

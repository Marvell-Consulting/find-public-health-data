// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import { indicatorTaskListSchema } from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { lockedDraftRedirect } from '../locked-draft.ts';

export type {
  IndicatorTaskKey,
  IndicatorTaskList,
  IndicatorTaskStatus,
} from '@fphd/internal-api-features/contract';

/**
 * The whole page in one call. The API answers 404 for an indicator that is missing or has no
 * draft, which the not-found boundary renders; a draft locked for review sends the publisher to
 * the overview.
 */
export async function loadIndicatorTaskList({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const taskList = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}/task-list`, indicatorTaskListSchema);

  if (!taskList.editable) throw lockedDraftRedirect(context, id);

  return { taskList };
}

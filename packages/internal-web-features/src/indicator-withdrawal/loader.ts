// No @fphd/ui imports here, so the loader and action unit-test without the components' jsdom.
import {
  indicatorAdminDetailSchema,
  indicatorWithdrawErrorSchema,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { requireEditableIndicator } from '../editable-indicator.ts';
import { requireIndicatorId } from '../indicator-id.ts';
import { setOverviewFlash } from '../indicator-overview/notifications.ts';
import { indicatorOverviewPath } from '../indicator-overview/paths.ts';

/**
 * The submission to withdraw. A draft never submitted has none, so the page does not exist; one
 * the workflow no longer lets the publisher withdraw sends them to the overview, which says so.
 */
export async function loadIndicatorWithdrawal({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const indicator = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}`, indicatorAdminDetailSchema);

  requireEditableIndicator(context, indicator);

  const { draftSubmissionNumber } = indicator;

  if (draftSubmissionNumber === null) throw new Response('Not Found', { status: 404 });

  if (!indicator.actions.includes('withdraw')) {
    setOverviewFlash(context, 'withdraw-refused');
    throw redirect(indicatorOverviewPath(id));
  }

  return { id, submissionNumber: draftSubmissionNumber };
}

/**
 * The confirmation page is the guard: this runs only from its POST. It withdraws the submission
 * the page showed and returns to the overview, which says whether it was withdrawn.
 */
export async function withdrawSubmission({
  context,
  params,
  request,
}: ActionFunctionArgs): Promise<Response> {
  const id = requireIndicatorId(params);
  const submissionNumber = Number((await request.formData()).get('submissionNumber'));
  const result = await context
    .get(apiContext)
    .postToMember(
      apiPath`/api/internal/indicators/${id}/withdraw`,
      { submissionNumber },
      indicatorWithdrawErrorSchema,
    );

  setOverviewFlash(context, result.ok ? 'submission-withdrawn' : 'withdraw-refused');

  return redirect(indicatorOverviewPath(id));
}

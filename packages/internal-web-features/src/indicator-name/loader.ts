// No @fphd/ui imports here, so the loader and actions unit-test without the jsdom the components need.
import {
  type IndicatorField,
  indicatorAdminDetailSchema,
  indicatorCreateErrorSchema,
  indicatorCreateResponseSchema,
  indicatorFieldSchema,
  indicatorNameSchema,
  indicatorUpdateErrorSchema,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { formRefusal } from '../form-refusal.ts';
import { requireIndicatorId } from '../indicator-id.ts';
import { type FormFailure, readFormValues } from '../indicator-section.ts';
import { indicatorTaskListPath } from '../publish-paths.ts';

export type { IndicatorAdminDetail } from '@fphd/internal-api-features/contract';

export type IndicatorNameFailure = FormFailure<IndicatorField>;

const FIELDS = indicatorFieldSchema.options;

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

/**
 * Creates the indicator and sends the publisher to its task list, where the rest of the
 * journey is. The API's schema is applied here first, so an empty name costs no round trip.
 */
export async function createIndicator({
  context,
  request,
}: ActionFunctionArgs): Promise<IndicatorNameFailure | Response> {
  const values = readFormValues(await request.formData(), FIELDS);
  const submission = indicatorNameSchema.safeParse(values);

  if (!submission.success) {
    return { values, fieldErrors: toFieldErrors(submission.error, FIELDS) };
  }

  const result = await context
    .get(apiContext)
    .post(
      '/api/internal/indicators',
      submission.data,
      indicatorCreateResponseSchema,
      indicatorCreateErrorSchema,
    );

  if (!result.ok) {
    return { values, ...formRefusal(result.error) };
  }

  return redirect(indicatorTaskListPath(result.data.id));
}

/** Only a draft can be renamed, so a published indicator has no name page. */
export async function loadIndicatorName({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const indicator = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}`, indicatorAdminDetailSchema);

  if (indicator.draftStatus === null) throw notFound();

  return { indicator };
}

/** Renames the draft and returns to the task list the publisher came from. */
export async function saveIndicatorName({
  context,
  params,
  request,
}: ActionFunctionArgs): Promise<IndicatorNameFailure | Response> {
  const id = requireIndicatorId(params);
  const values = readFormValues(await request.formData(), FIELDS);
  const submission = indicatorNameSchema.safeParse(values);

  if (!submission.success) {
    return { values, fieldErrors: toFieldErrors(submission.error, FIELDS) };
  }

  const result = await context
    .get(apiContext)
    .patch(
      apiPath`/api/internal/indicators/${id}`,
      submission.data,
      indicatorAdminDetailSchema,
      indicatorUpdateErrorSchema,
    );

  if (!result.ok) {
    return { values, ...formRefusal(result.error) };
  }

  return redirect(indicatorTaskListPath(id));
}

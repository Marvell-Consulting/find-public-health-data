// No @fphd/ui imports here, so the loader and actions unit-test without the jsdom components need.
import {
  type IndicatorFieldErrors,
  indicatorAdminDetailSchema,
  indicatorCreateErrorSchema,
  indicatorCreateResponseSchema,
  indicatorFieldSchema,
  indicatorIdSchema,
  indicatorNameSchema,
  indicatorUpdateErrorSchema,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { apiPath } from '@fphd/web-server/api-client';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from 'react-router';

import { indicatorOverviewPath } from '../indicator-overview/paths.ts';

export type {
  IndicatorAdminDetail,
  IndicatorFieldErrors,
} from '@fphd/internal-api-features/contract';

export interface IndicatorNameFailure {
  name: string;
  fieldErrors: IndicatorFieldErrors;
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}

/** An address that is not an id names nothing, so it is a 404 rather than an API error. */
function requireIndicatorId(params: LoaderFunctionArgs['params']): string {
  const id = indicatorIdSchema.safeParse(params.id);

  if (!id.success) throw notFound();

  return id.data;
}

/** The name as typed, so a rejected submission re-renders the form exactly as it was sent. */
function readName(formData: FormData): string {
  const value = formData.get('name');

  return typeof value === 'string' ? value : '';
}

/**
 * Creates the indicator and sends the publisher to its overview page, where the journey goes
 * on. The API's schema is applied here first, so an empty name costs no round trip.
 */
export async function createIndicator({
  context,
  request,
}: ActionFunctionArgs): Promise<IndicatorNameFailure | Response> {
  const name = readName(await request.formData());
  const submission = indicatorNameSchema.safeParse({ name });

  if (!submission.success) {
    return { name, fieldErrors: toFieldErrors(submission.error, indicatorFieldSchema.options) };
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
    return { name, fieldErrors: result.error.fieldErrors ?? {} };
  }

  return redirect(indicatorOverviewPath(result.data.id));
}

/** Only a draft can be renamed, so a published indicator has no name page. */
export async function loadIndicatorName({ context, params }: LoaderFunctionArgs) {
  const id = requireIndicatorId(params);
  const indicator = await context
    .get(apiContext)
    .get(apiPath`/api/internal/indicators/${id}`, indicatorAdminDetailSchema);

  if (indicator.status !== 'draft') throw notFound();

  return { indicator };
}

/** Renames the draft and returns to the overview page the publisher came from. */
export async function saveIndicatorName({
  context,
  params,
  request,
}: ActionFunctionArgs): Promise<IndicatorNameFailure | Response> {
  const id = requireIndicatorId(params);
  const name = readName(await request.formData());
  const submission = indicatorNameSchema.safeParse({ name });

  if (!submission.success) {
    return { name, fieldErrors: toFieldErrors(submission.error, indicatorFieldSchema.options) };
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
    return { name, fieldErrors: result.error.fieldErrors ?? {} };
  }

  return redirect(indicatorOverviewPath(id));
}

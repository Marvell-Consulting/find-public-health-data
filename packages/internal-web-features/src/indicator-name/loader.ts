// No @fphd/ui imports here, so the action unit-tests without the jsdom the components need.
import {
  type IndicatorFieldErrors,
  indicatorCreateErrorSchema,
  indicatorCreateResponseSchema,
  indicatorNameSchema,
  toFieldErrors,
} from '@fphd/internal-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import { type ActionFunctionArgs, redirect } from 'react-router';

import { indicatorOverviewPath } from '../indicator-overview/paths.ts';

export type { IndicatorFieldErrors } from '@fphd/internal-api-features/contract';

export interface IndicatorNameFailure {
  name: string;
  fieldErrors: IndicatorFieldErrors;
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
    return { name, fieldErrors: toFieldErrors(submission.error) };
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

// No @fphd/ui imports here, so the loader and action unit-test without the jsdom the components need.
import {
  ciMethodListSchema,
  confidenceIntervalsSection,
} from '@fphd/internal-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';

export type { CiMethod, ConfidenceIntervalsField } from '@fphd/internal-api-features/contract';

/** The draft's answers, and every method the form offers with what each asks next. */
export async function loadConfidenceIntervals(args: LoaderFunctionArgs) {
  // Checked before either request, so an id that names nothing asks the API for neither.
  requireIndicatorId(args.params);

  const [section, methods] = await Promise.all([
    loadIndicatorSection(args, confidenceIntervalsSection),
    args.context.get(apiContext).get('/api/internal/ci-methods', ciMethodListSchema),
  ]);

  return { ...section, methods };
}

/** The form checks that a method is chosen; the API checks what that method asks for. */
export function saveConfidenceIntervals(args: ActionFunctionArgs) {
  return saveIndicatorSection(args, confidenceIntervalsSection);
}

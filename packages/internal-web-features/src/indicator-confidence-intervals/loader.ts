// No @fphd/ui imports here, so the loader unit-tests without the jsdom the components need.
import {
  ciMethodListSchema,
  confidenceIntervalsSection,
} from '@fphd/internal-api-features/contract';
import { apiContext } from '@fphd/web-server/api-context';
import type { LoaderFunctionArgs } from 'react-router';

import { requireIndicatorId } from '../indicator-id.ts';
import { loadIndicatorSection } from '../indicator-section.ts';

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

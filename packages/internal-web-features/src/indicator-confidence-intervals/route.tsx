import {
  type ConfidenceIntervalsField,
  confidenceIntervalsSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import { type ActionFunctionArgs, useLoaderData } from 'react-router';

import { saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { loadConfidenceIntervals } from './loader.ts';
import { ConfidenceIntervalsPage } from './page.tsx';

export const loader = loadConfidenceIntervals;

// The form checks that a method is chosen; the API checks what that method asks for.
export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, confidenceIntervalsSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function ConfidenceIntervalsRoute() {
  const { methods } = useLoaderData<typeof loader>();
  const form = useSectionForm<ConfidenceIntervalsField>();

  return <ConfidenceIntervalsPage {...form} methods={methods} />;
}

export default ConfidenceIntervalsRoute;

import { type PeriodTypeField, periodTypeSection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { PeriodTypePage, periodTypeControlNames } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) => loadIndicatorSection(args, periodTypeSection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, periodTypeSection, periodTypeControlNames);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function PeriodTypeRoute() {
  return <PeriodTypePage {...useSectionForm<PeriodTypeField>()} />;
}

export default PeriodTypeRoute;

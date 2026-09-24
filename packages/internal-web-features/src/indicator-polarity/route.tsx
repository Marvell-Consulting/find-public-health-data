import { type PolarityField, polaritySection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { PolarityPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) => loadIndicatorSection(args, polaritySection);

export const action = (args: ActionFunctionArgs) => saveIndicatorSection(args, polaritySection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function PolarityRoute() {
  return <PolarityPage {...useSectionForm<PolarityField>()} />;
}

export default PolarityRoute;

import { type CalculationField, calculationSection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { CalculationPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) => loadIndicatorSection(args, calculationSection);

export const action = (args: ActionFunctionArgs) => saveIndicatorSection(args, calculationSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function CalculationRoute() {
  return <CalculationPage {...useSectionForm<CalculationField>()} />;
}

export default CalculationRoute;

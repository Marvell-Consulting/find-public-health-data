import {
  type VarianceAndQualityField,
  varianceAndQualitySection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { VarianceAndQualityPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, varianceAndQualitySection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, varianceAndQualitySection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function VarianceAndQualityRoute() {
  return <VarianceAndQualityPage {...useSectionForm<VarianceAndQualityField>()} />;
}

export default VarianceAndQualityRoute;

import { type DataQualityField, dataQualitySection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { DataQualityPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) => loadIndicatorSection(args, dataQualitySection);

export const action = (args: ActionFunctionArgs) => saveIndicatorSection(args, dataQualitySection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function DataQualityRoute() {
  return <DataQualityPage {...useSectionForm<DataQualityField>()} />;
}

export default DataQualityRoute;

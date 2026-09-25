import {
  type ValueTypeAndUnitsField,
  valueTypeAndUnitsSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { ValueTypeAndUnitsPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, valueTypeAndUnitsSection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, valueTypeAndUnitsSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function ValueTypeAndUnitsRoute() {
  return <ValueTypeAndUnitsPage {...useSectionForm<ValueTypeAndUnitsField>()} />;
}

export default ValueTypeAndUnitsRoute;

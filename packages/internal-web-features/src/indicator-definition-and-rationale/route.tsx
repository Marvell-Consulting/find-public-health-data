import {
  type DefinitionAndRationaleField,
  definitionAndRationaleSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { DefinitionAndRationalePage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, definitionAndRationaleSection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, definitionAndRationaleSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function DefinitionAndRationaleRoute() {
  return <DefinitionAndRationalePage {...useSectionForm<DefinitionAndRationaleField>()} />;
}

export default DefinitionAndRationaleRoute;

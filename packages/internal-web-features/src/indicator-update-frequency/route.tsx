import {
  type UpdateFrequencyField,
  updateFrequencySection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { UpdateFrequencyPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, updateFrequencySection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, updateFrequencySection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function UpdateFrequencyRoute() {
  return <UpdateFrequencyPage {...useSectionForm<UpdateFrequencyField>()} />;
}

export default UpdateFrequencyRoute;

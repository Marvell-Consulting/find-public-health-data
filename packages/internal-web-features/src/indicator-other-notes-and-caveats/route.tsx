import {
  type OtherNotesAndCaveatsField,
  otherNotesAndCaveatsSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { OtherNotesAndCaveatsPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, otherNotesAndCaveatsSection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, otherNotesAndCaveatsSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function OtherNotesAndCaveatsRoute() {
  return <OtherNotesAndCaveatsPage {...useSectionForm<OtherNotesAndCaveatsField>()} />;
}

export default OtherNotesAndCaveatsRoute;

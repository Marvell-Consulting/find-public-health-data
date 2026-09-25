import {
  type OtherCommentsField,
  otherCommentsSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { OtherCommentsPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, otherCommentsSection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, otherCommentsSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function OtherCommentsRoute() {
  return <OtherCommentsPage {...useSectionForm<OtherCommentsField>()} />;
}

export default OtherCommentsRoute;

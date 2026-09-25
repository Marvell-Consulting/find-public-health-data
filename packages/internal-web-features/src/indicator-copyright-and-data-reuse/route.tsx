import {
  type CopyrightAndDataReuseField,
  copyrightAndDataReuseSection,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { CopyrightAndDataReusePage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadIndicatorSection(args, copyrightAndDataReuseSection);

export const action = (args: ActionFunctionArgs) =>
  saveIndicatorSection(args, copyrightAndDataReuseSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function CopyrightAndDataReuseRoute() {
  return <CopyrightAndDataReusePage {...useSectionForm<CopyrightAndDataReuseField>()} />;
}

export default CopyrightAndDataReuseRoute;

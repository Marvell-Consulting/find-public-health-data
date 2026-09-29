import type {
  SexAndAgesFormValues,
  SexAndAgesPageField,
} from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';

import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { loadSexAndAges, submitSexAndAges } from './loader.ts';
import { SexAndAgesPage } from './page.tsx';

export const loader = loadSexAndAges;

export const action = submitSexAndAges;

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

// After Add or a remove, the action's answer is the page with its ranges changed.
export function SexAndAgesRoute() {
  return <SexAndAgesPage {...useSectionForm<SexAndAgesPageField, SexAndAgesFormValues>()} />;
}

export default SexAndAgesRoute;

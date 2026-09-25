import { titleFromPage } from '@fphd/ui';

import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import type { LinksPageField, LinksPageValues } from './form.ts';
import { loadLinks, submitLinks } from './loader.ts';
import { LinksPage } from './page.tsx';

export const loader = loadLinks;

export const action = submitLinks;

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

// After Add or a remove, the action's answer is the page with its list changed.
export function LinksRoute() {
  return <LinksPage {...useSectionForm<LinksPageField, LinksPageValues>()} />;
}

export default LinksRoute;

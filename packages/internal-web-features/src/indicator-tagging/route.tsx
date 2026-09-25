import { titleFromPage } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import type { TaggingPageField, TaggingPageValues } from './form.ts';
import { loadTagging, submitTagging } from './loader.ts';
import { TaggingPage } from './page.tsx';

export const loader = loadTagging;

export const action = submitTagging;

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

// After an Add or a Remove, the action's answer is the page with that list changed.
export function TaggingRoute() {
  const { options } = useLoaderData<typeof loader>();
  const form = useSectionForm<TaggingPageField, TaggingPageValues>();

  return <TaggingPage {...form} options={options} />;
}

export default TaggingRoute;

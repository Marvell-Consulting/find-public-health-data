import { numeratorSection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import { type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData } from 'react-router';

import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import type { ProviderSourcesPageField, ProviderSourcesPageValues } from './form.ts';
import { loadProviderSources, submitProviderSources } from './loader.ts';
import { ProviderSourcesPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) => loadProviderSources(args, numeratorSection);

export const action = (args: ActionFunctionArgs) => submitProviderSources(args, numeratorSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function NumeratorRoute() {
  const { providers } = useLoaderData<typeof loader>();

  return (
    <ProviderSourcesPage
      part="numerator"
      providers={providers}
      {...useSectionForm<ProviderSourcesPageField, ProviderSourcesPageValues>()}
    />
  );
}

export default NumeratorRoute;

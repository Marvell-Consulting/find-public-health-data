import { denominatorSection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import { type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData } from 'react-router';

import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import type { NumeratorDenominatorPageField, NumeratorDenominatorPageValues } from './form.ts';
import { loadNumeratorDenominator, submitNumeratorDenominator } from './loader.ts';
import { NumeratorDenominatorPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadNumeratorDenominator(args, denominatorSection);

export const action = (args: ActionFunctionArgs) =>
  submitNumeratorDenominator(args, denominatorSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function DenominatorRoute() {
  const { providers } = useLoaderData<typeof loader>();

  return (
    <NumeratorDenominatorPage
      part="denominator"
      providers={providers}
      {...useSectionForm<NumeratorDenominatorPageField, NumeratorDenominatorPageValues>()}
    />
  );
}

export default DenominatorRoute;

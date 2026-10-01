import { numeratorSection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import { type ActionFunctionArgs, type LoaderFunctionArgs, useLoaderData } from 'react-router';

import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import type { NumeratorDenominatorPageField, NumeratorDenominatorPageValues } from './form.ts';
import { loadNumeratorDenominator, submitNumeratorDenominator } from './loader.ts';
import { NumeratorDenominatorPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) =>
  loadNumeratorDenominator(args, numeratorSection);

export const action = (args: ActionFunctionArgs) =>
  submitNumeratorDenominator(args, numeratorSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function NumeratorRoute() {
  const { providers } = useLoaderData<typeof loader>();

  return (
    <NumeratorDenominatorPage
      part="numerator"
      providers={providers}
      {...useSectionForm<NumeratorDenominatorPageField, NumeratorDenominatorPageValues>()}
    />
  );
}

export default NumeratorRoute;

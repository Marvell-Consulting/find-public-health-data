import { type BenchmarkingField, benchmarkingSection } from '@fphd/internal-api-features/contract';
import { titleFromPage } from '@fphd/ui';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

import { loadIndicatorSection, saveIndicatorSection } from '../indicator-section.ts';
import { sectionBackLinkHandle, useSectionForm } from '../indicator-section-route.ts';
import { BenchmarkingPage } from './page.tsx';

export const loader = (args: LoaderFunctionArgs) => loadIndicatorSection(args, benchmarkingSection);

export const action = (args: ActionFunctionArgs) => saveIndicatorSection(args, benchmarkingSection);

export const meta = titleFromPage;

export const handle = sectionBackLinkHandle;

export function BenchmarkingRoute() {
  return <BenchmarkingPage {...useSectionForm<BenchmarkingField>()} />;
}

export default BenchmarkingRoute;

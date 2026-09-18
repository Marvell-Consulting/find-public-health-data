import { createDocumentMeta } from '@fphd/ui';
import { type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';

import { loadIndicator } from './loader.ts';
import { IndicatorPage } from './page.tsx';

export const loader = loadIndicator;

// Changing a display option only re-renders with data the page already has; benchmark
// options (`cmp-`, `cr-`) are not listed because they decide what the loader fetches.
const DISPLAY_OPTION_PARAM = /^(ci|pt|sex|tab|ic|ip)-/;

export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  const strip = (url: URL) => {
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (DISPLAY_OPTION_PARAM.test(key)) {
        params.delete(key);
      }
    }
    return `${url.pathname}?${params.toString()}`;
  };
  return strip(currentUrl) !== strip(nextUrl);
}

export const meta = createDocumentMeta('Indicator');

export function IndicatorRoute() {
  const {
    selected,
    selectedAreas,
    displayGroups,
    benchmarkGeography,
    findResults,
    findSubject,
    geographyOptions,
    areasLimited,
    indicatorsLimited,
    selection,
  } = useLoaderData<typeof loader>();
  return (
    <IndicatorPage
      selected={selected}
      selectedAreas={selectedAreas}
      displayGroups={displayGroups}
      benchmarkGeography={benchmarkGeography}
      findResults={findResults}
      findSubject={findSubject}
      geographyOptions={geographyOptions}
      areasLimited={areasLimited}
      indicatorsLimited={indicatorsLimited}
      selection={selection}
    />
  );
}

export default IndicatorRoute;

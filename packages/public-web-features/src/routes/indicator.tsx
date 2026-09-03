import { createDocumentMeta } from '@fphd/ui';
import { type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';

import { loadIndicator } from '../indicator-loader';
import { IndicatorPage } from '../indicator-page';

export const loader = loadIndicator;

// Changing a display option only re-renders with data the page already has; benchmark
// options (`cmp-`, `cr-`) are not listed because they decide what the loader fetches.
const DISPLAY_OPTION_PARAM = /^(ci|pt|sex|tab)-/;

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
  const { selected, selectedAreas, benchmarkGeography, findResults, findSubject, selection } =
    useLoaderData<typeof loader>();
  return (
    <IndicatorPage
      selected={selected}
      selectedAreas={selectedAreas}
      benchmarkGeography={benchmarkGeography}
      findResults={findResults}
      findSubject={findSubject}
      selection={selection}
    />
  );
}

export default IndicatorRoute;

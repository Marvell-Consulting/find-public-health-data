import { createDocumentMeta } from '@fphd/ui';
import { type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';

import { loadIndicator } from '../indicator-loader';
import { IndicatorPage } from '../indicator-page';

export const loader = loadIndicator;

// Changing a table option only re-renders with data the page already has; stripping the
// option params shows whether anything the loader cares about actually changed. Each
// table's params carry its own suffix (`ci-241`, `tab-241`, `cmp-compare`), hence the prefix match.
const OPTION_PARAM = /^(ci|pt|sex|cmp|cr|tab)-/;

export function shouldRevalidate({ currentUrl, nextUrl }: ShouldRevalidateFunctionArgs) {
  const strip = (url: URL) => {
    const params = new URLSearchParams(url.search);
    for (const key of [...params.keys()]) {
      if (OPTION_PARAM.test(key)) {
        params.delete(key);
      }
    }
    return `${url.pathname}?${params.toString()}`;
  };
  return strip(currentUrl) !== strip(nextUrl);
}

export const meta = createDocumentMeta('Indicator');

export function IndicatorRoute() {
  const { selected, areaGroups, benchmarkGeography, findResults, findSubject, selection } =
    useLoaderData<typeof loader>();
  return (
    <IndicatorPage
      selected={selected}
      areaGroups={areaGroups}
      benchmarkGeography={benchmarkGeography}
      findResults={findResults}
      findSubject={findSubject}
      selection={selection}
    />
  );
}

export default IndicatorRoute;

import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { loadIndicator } from '../indicator-loader';
import { IndicatorPage } from '../indicator-page';

export const loader = loadIndicator;

export const meta = createDocumentMeta('Indicator');

export function IndicatorRoute() {
  const { selected, areaGroups, availableIndicators, selection } = useLoaderData<typeof loader>();
  return (
    <IndicatorPage
      selected={selected}
      areaGroups={areaGroups}
      availableIndicators={availableIndicators}
      selection={selection}
    />
  );
}

export default IndicatorRoute;

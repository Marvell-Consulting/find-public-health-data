import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { loadIndicator } from '../indicator-loader';
import { IndicatorPage } from '../indicator-page';

export const loader = loadIndicator;

export const meta = createDocumentMeta('Indicator');

export function IndicatorRoute() {
  const { indicator, availableAreas, areaData, selection } = useLoaderData<typeof loader>();
  return (
    <IndicatorPage
      indicator={indicator}
      availableAreas={availableAreas}
      areaData={areaData}
      selection={selection}
    />
  );
}

export default IndicatorRoute;

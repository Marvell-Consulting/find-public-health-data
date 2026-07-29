import { createDocumentMeta } from '@fphd/ui';
import { useLoaderData } from 'react-router';

import { loadIndicator } from '../indicator-loader';
import { IndicatorPage } from '../indicator-page';

export const loader = loadIndicator;

export const meta = createDocumentMeta('Indicator');

export function IndicatorRoute() {
  const { indicator, data } = useLoaderData<typeof loader>();
  return <IndicatorPage indicator={indicator} data={data} />;
}

export default IndicatorRoute;

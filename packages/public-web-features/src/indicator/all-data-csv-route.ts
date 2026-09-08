import type { LoaderFunctionArgs } from 'react-router';

import { loadIndicatorCsv } from './csv';

export function loader(args: LoaderFunctionArgs) {
  return loadIndicatorCsv(args, 'all-data');
}

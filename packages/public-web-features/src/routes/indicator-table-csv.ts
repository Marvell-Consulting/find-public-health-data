import type { LoaderFunctionArgs } from 'react-router';

import { loadIndicatorCsv } from '../indicator-csv';

export function loader(args: LoaderFunctionArgs) {
  return loadIndicatorCsv(args, 'table');
}

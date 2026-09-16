import type { LoaderFunctionArgs } from 'react-router';

import { loadIndicatorCsv } from './csv.js';

export function loader(args: LoaderFunctionArgs) {
  return loadIndicatorCsv(args, 'table');
}

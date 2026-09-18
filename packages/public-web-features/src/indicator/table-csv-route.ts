import type { LoaderFunctionArgs } from 'react-router';

import { loadIndicatorCsv } from './csv.ts';

export function loader(args: LoaderFunctionArgs) {
  return loadIndicatorCsv(args, 'table');
}

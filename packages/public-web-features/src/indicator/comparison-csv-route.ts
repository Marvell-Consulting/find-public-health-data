import type { LoaderFunctionArgs } from 'react-router';

import { comparisonTable } from './comparison';
import { comparisonCsv } from './download';
import { loadIndicator } from './loader';

export async function loader(args: LoaderFunctionArgs) {
  const { selected, benchmarkGeography } = await loadIndicator(args);
  const params = new URL(args.request.url).searchParams;
  const choice = params.get('cmp-compare');
  const benchmark = choice === 'england' || choice === 'region' ? choice : 'none';
  return new Response(
    comparisonCsv(
      comparisonTable(selected, benchmarkGeography, benchmark),
      params.get('cr-compare') === 'yes',
    ),
    {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="compare-indicators.csv"',
      },
    },
  );
}

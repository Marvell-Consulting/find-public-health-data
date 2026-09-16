import type { LoaderFunctionArgs } from 'react-router';

import { comparisonTable } from './comparison.js';
import { comparisonCsv } from './download.js';
import { loadComparisonData } from './loader.js';

export async function loader(args: LoaderFunctionArgs) {
  const { selected, benchmarkGeography } = await loadComparisonData(args);
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

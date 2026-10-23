import type { LoaderFunctionArgs } from 'react-router';
import { comparisonTable } from '../indicator/comparison.ts';
import { benchmarkJudgement } from '../indicator/data.ts';
import { comparisonCsv, tableCsv } from '../indicator/download.ts';
import { englandObservation, observationPeriod } from './data.ts';
import { loadTopic } from './loader.ts';

export async function loader(args: LoaderFunctionArgs) {
  const url = new URL(args.request.url);
  if (url.searchParams.get('tab-topic') !== 'areas') url.searchParams.set('tab-topic', 'data');
  const { topic, content } = await loadTopic({ ...args, request: new Request(url) });
  if (!content) throw new Error('Topic table download expects table data');
  const { data } = content;
  const areasTab = new URL(args.request.url).searchParams.get('tab-topic') === 'areas';
  const model = comparisonTable(
    data.selected,
    data.benchmarkGeography,
    areasTab ? 'england' : 'none',
  );
  const byId = new Map(data.selected.map((entry) => [entry.detail.shortId, entry]));
  const areas = model.areas.filter(({ areaCode }) => areaCode !== 'E92000001');
  const csv = areasTab
    ? tableCsv([
        [
          'Indicator',
          'Unit',
          'Latest period',
          'England',
          'England period',
          ...areas.flatMap(({ areaName }) => [
            areaName,
            `${areaName} period`,
            `${areaName} comparison`,
            `${areaName} notes`,
          ]),
        ],
        ...model.rows.map((row) => {
          const entry = byId.get(row.shortId);
          if (!entry) return [];
          const england = englandObservation(entry, row);
          return [
            row.name + (row.suffix ? ` ${row.suffix}` : ''),
            row.unit,
            row.period,
            england?.value ?? null,
            observationPeriod(entry, england),
            ...row.cells
              .filter(({ areaCode }) => areaCode !== 'E92000001')
              .flatMap((cell) => {
                const benchmark = model.benchmarkCellFor(row, cell);
                return [
                  cell.value,
                  observationPeriod(entry, cell.series.at(-1)),
                  cell.value === null
                    ? 'No data'
                    : benchmarkJudgement(
                        benchmark?.areaObservation,
                        benchmark?.value ?? null,
                        entry.detail,
                      ),
                  cell.notes.join('; '),
                ];
              }),
          ];
        }),
      ])
    : comparisonCsv(model, false);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${topic.slug}-${areasTab ? 'area-summaries' : 'data'}.csv"`,
    },
  });
}

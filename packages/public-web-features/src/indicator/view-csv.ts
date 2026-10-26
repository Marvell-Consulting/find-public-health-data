import type { LoaderFunctionArgs } from 'react-router';
import {
  areaComparisonGroups,
  areaComparisonLabel,
  areaComparisonRows,
  observationComparisonLabel,
} from './area-comparison.ts';
import {
  availableConfidenceLevels,
  inequalityBreakdown,
  inequalityCategories,
  inequalityPeriods,
  inequalityValueLabel,
  trendSeries,
  unitNote,
} from './data.ts';
import { tableCsv } from './download.ts';
import { indicatorPair } from './indicator-pair.ts';
import { loadIndicator } from './loader.ts';

export async function loadIndicatorViewCsv(args: LoaderFunctionArgs): Promise<Response> {
  const data = await loadIndicator(args);
  const primary = data.selected[0];
  if (!primary) throw new Response('Not Found', { status: 404 });
  const params = new URL(args.request.url).searchParams;
  const tab = params.get('tab-indicator');
  const id = primary.detail.shortId;
  let rows: (string | number | null)[][];
  if (tab === 'areas') {
    const areas = areaComparisonRows(
      primary,
      data.compareAreasData,
      params.get('areaSort') ?? 'descending',
    );
    const colour = params.get('areaColour') ?? 'england';
    const groups = areaComparisonGroups(areas.rows, colour);
    rows = [
      [
        'Area',
        `Value${unitNote(primary.detail.unit)}`,
        groups.heading,
        '95% lower confidence interval',
        '95% upper confidence interval',
      ],
      ...areas.rows.map((cell) => [
        cell.areaName + (cell.areaCode === 'E92000001' ? ' (benchmark)' : ''),
        cell.value,
        colour === 'quartiles' || colour === 'quintiles'
          ? (groups.labels.get(cell.areaCode) ?? '')
          : areaComparisonLabel(cell, areas.england, primary.detail),
        cell.series.at(-1)?.lowerCi95 ?? null,
        cell.series.at(-1)?.upperCi95 ?? null,
      ]),
    ];
  } else if (tab === 'compare') {
    const compared = data.selected[1];
    if (!compared) throw new Response('Not Found', { status: 404 });
    const model = indicatorPair([
      {
        ...primary,
        areaData: [
          ...primary.areaData.filter(({ areaCode }) => areaCode === 'E92000001'),
          ...data.compareAreasData,
        ],
      },
      {
        ...compared,
        areaData: [
          ...compared.areaData.filter(({ areaCode }) => areaCode === 'E92000001'),
          ...data.comparedAreasData,
        ],
      },
    ]);
    const sorted = [
      ...(model.england ? [model.england] : []),
      ...model.areas.filter(({ code }) => params.getAll('highlight').includes(code)),
    ];
    rows = [
      [
        'Area',
        `${primary.detail.name}${unitNote(primary.detail.unit)} (${model.periods[0]})`,
        `${compared.detail.name}${unitNote(compared.detail.unit)} (${model.periods[1]})`,
      ],
      ...sorted.map((cell) => [cell.name, ...cell.values]),
      ...(model.areas.length
        ? [[`${data.compareAreaGroup} (${model.areas.length} areas)`, ...model.range]]
        : []),
    ];
  } else {
    const observations =
      primary.areaData.find(({ areaCode }) => areaCode === (params.get(`ig-${id}`) ?? 'E92000001'))
        ?.observations ??
      primary.areaData[0]?.observations ??
      [];
    const categories = inequalityCategories(observations);
    const requestedCategory = params.get(`ic-${id}`) ?? '';
    const category = categories.includes(requestedCategory)
      ? requestedCategory
      : (categories[0] ?? '');
    const periods = inequalityPeriods(observations, category, primary.detail.yearType);
    const requestedPeriod = params.get(`ip-${id}`) ?? '';
    const period = periods.some(({ value }) => value === requestedPeriod)
      ? requestedPeriod
      : (periods.at(-1)?.value ?? '');
    const levels = availableConfidenceLevels(
      primary.areaData.flatMap(({ observations }) => observations),
    );
    const requestedConfidence = params.get(`ci-${id}`);
    const confidence = levels.includes(requestedConfidence as '95' | '99.8')
      ? (requestedConfidence as '95' | '99.8')
      : 'none';
    const breakdown = inequalityBreakdown(observations, category, period);
    const englandObservations =
      primary.areaData.find(({ areaCode }) => areaCode === 'E92000001')?.observations ?? [];
    const benchmarkObservation = trendSeries(englandObservations).find(
      (row) => row.fromDate === breakdown[0]?.fromDate && row.toDate === breakdown[0]?.toDate,
    );
    const benchmark = benchmarkObservation?.value ?? null;
    const comparisonConfidence = params.has(`ci-${id}`)
      ? confidence
      : levels.includes('99.8')
        ? '99.8'
        : levels.includes('95')
          ? '95'
          : 'none';
    rows = [
      ['Segment', 'Count', `Value${unitNote(primary.detail.unit)}`, 'Compared with England'],
      ['England', benchmarkObservation?.count ?? null, benchmark, 'Benchmark'],
      ...breakdown.map((observation) => [
        inequalityValueLabel(observation),
        observation.count,
        observation.value,
        observationComparisonLabel(
          observation,
          benchmark,
          primary.detail,
          comparisonConfidence === '99.8' ? '99.8' : '95',
        ),
      ]),
    ];
  }
  return new Response(tableCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${id}-${tab}.csv"`,
    },
  });
}

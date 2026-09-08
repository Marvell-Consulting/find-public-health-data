import { Fragment } from 'react';
import {
  alignedTrendSeries,
  type ConfidenceLevel,
  formatCalculatedValue,
  formatValue,
  periodLabel,
  segmentLabel,
  segmentValuesKey,
  trendSeries,
} from '../data';
import type {
  BenchmarkGeography,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
  IndicatorRangePeriod,
} from '../loader';
import type { BenchmarkChoice } from '../options';
import { BenchmarkCells, BenchmarkHeaderCells } from './benchmark-cells';
import { TableScrollRegion } from './table-scroll-region';

interface AreaBenchmark {
  name: string;
  series: IndicatorObservation[];
  rangePeriods: IndicatorRangePeriod[];
}

export function TrendTable({
  areaData,
  benchmark = 'none',
  confidence,
  geography = { regionByCode: {}, levelByCode: {} },
  indicator,
  ranges = {},
  regionData = [],
  showRange = false,
}: {
  areaData: IndicatorAreaData[];
  benchmark?: BenchmarkChoice;
  confidence: ConfidenceLevel;
  geography?: BenchmarkGeography;
  indicator: IndicatorDetail;
  ranges?: Record<string, IndicatorRangePeriod[]>;
  regionData?: IndicatorAreaData[];
  showRange?: boolean;
}) {
  // England is a column only when it is the sole area; picked areas get it back as a shaded benchmark group.
  const nonEngland = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  const england = areaData.filter(({ areaCode }) => areaCode === 'E92000001');
  const shownAreas = nonEngland.length === 0 ? areaData : nonEngland;
  const benchmarkActive = benchmark !== 'none' && nonEngland.length > 0;
  // The first area's series sets the table's segment and every column follows it.
  const reference = shownAreas[0] ? trendSeries(shownAreas[0].observations)[0] : undefined;
  const referenceSegment = reference ? segmentValuesKey(reference) : '';
  const seriesFor = (observations: IndicatorObservation[]) =>
    alignedTrendSeries(observations, reference);
  const englandSeries = england[0] ? seriesFor(england[0].observations) : [];
  const benchmarkFor = (areaCode: string): AreaBenchmark | undefined => {
    if (!benchmarkActive) {
      return undefined;
    }
    if (benchmark === 'england') {
      return {
        name: 'England',
        series: englandSeries,
        rangePeriods: ranges[geography.levelByCode[areaCode] ?? ''] ?? [],
      };
    }
    const region = geography.regionByCode[areaCode];
    if (!region) {
      return undefined;
    }
    const data = regionData.find(({ areaCode: code }) => code === region.code);
    return {
      name: `${region.name} (Statistical region)`,
      series: data ? seriesFor(data.observations) : [],
      rangePeriods: ranges['Statistical regions'] ?? [],
    };
  };
  const seriesByArea = shownAreas
    .map((data) => ({ data, series: seriesFor(data.observations) }))
    .filter(({ series }) => series.length > 0);
  const firstObservation = seriesByArea[0]?.series[0];
  if (!firstObservation) {
    return <p className="govuk-body">No data matches the selected options.</p>;
  }

  const benchmarks = new Map(
    seriesByArea.map(({ data }) => [data.areaCode, benchmarkFor(data.areaCode)]),
  );
  const benchmarkColumns = 1 + (showRange ? 3 : 0);

  // Rows come from the shown areas alone; a benchmark annotates them, never adds them.
  const periods = [
    ...new Map(
      shownAreas
        .flatMap(({ observations }) => seriesFor(observations))
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate))
        .map((observation) => [
          `${observation.fromDate}|${observation.toDate}`,
          { fromDate: observation.fromDate, toDate: observation.toDate },
        ]),
    ).values(),
  ];
  const inPeriod =
    (period: (typeof periods)[number]) => (row: { fromDate: string; toDate: string }) =>
      row.fromDate === period.fromDate && row.toDate === period.toDate;
  const cell = (areaSeries: (typeof seriesByArea)[number], period: (typeof periods)[number]) =>
    areaSeries.series.find(inPeriod(period));
  // Indicators without raw counts drop the column rather than render a column of dashes.
  const hasCounts = seriesByArea.some(({ series }) => series.some(({ count }) => count !== null));
  const columnsPerArea = (hasCounts ? 2 : 1) + (confidence === 'none' ? 0 : 2);
  const valueSuffix = indicator.unit.label === '%' ? '%' : '';
  const lowerOf = (observation: IndicatorObservation) =>
    confidence === '99.8' ? observation.lowerCi998 : observation.lowerCi95;
  const upperOf = (observation: IndicatorObservation) =>
    confidence === '99.8' ? observation.upperCi998 : observation.upperCi95;
  // Every distinct value note gets a sequential marker, explained under the table.
  const noteTexts = [
    ...new Set(
      seriesByArea
        .flatMap(({ series }) => series)
        .flatMap(({ notes }) => notes)
        .map(({ text }) => text),
    ),
  ];
  const markers = ['*', '**', '***', '****'];
  const markerFor = (text: string) => markers[noteTexts.indexOf(text)] ?? '*';

  return (
    <>
      <TableScrollRegion label={`${indicator.name} trends over time`}>
        <table className="govuk-table fphd-trend-table">
          <caption className="govuk-table__caption govuk-visually-hidden">
            {indicator.name} trends over time, {segmentLabel(firstObservation)}
          </caption>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <td />
              {seriesByArea.map(({ data }) => (
                <Fragment key={data.areaCode}>
                  <th scope="colgroup" colSpan={columnsPerArea} className="govuk-table__header">
                    {data.areaName}
                  </th>
                  {benchmarks.get(data.areaCode) ? (
                    <th
                      scope="colgroup"
                      colSpan={benchmarkColumns}
                      className="govuk-table__header fphd-trend-table__benchmark-group"
                    >
                      {benchmarks.get(data.areaCode)?.name}
                    </th>
                  ) : null}
                </Fragment>
              ))}
            </tr>
            <tr className="govuk-table__row">
              <th scope="col" className="govuk-table__header">
                Period
              </th>
              {seriesByArea.map(({ data }) => (
                <Fragment key={data.areaCode}>
                  {hasCounts ? (
                    <th scope="col" className="govuk-table__header">
                      Count <span className="fphd-table-note">(Raw number)</span>
                    </th>
                  ) : null}
                  <th scope="col" className="govuk-table__header">
                    Calculated value{' '}
                    <span className="fphd-table-note">({indicator.unit.label})</span>
                  </th>
                  {confidence === 'none' ? null : (
                    <>
                      <th scope="col" className="govuk-table__header">
                        {confidence}% lower confidence interval
                      </th>
                      <th scope="col" className="govuk-table__header">
                        {confidence}% upper confidence interval
                      </th>
                    </>
                  )}
                  {benchmarks.get(data.areaCode) ? (
                    <BenchmarkHeaderCells
                      showRange={showRange}
                      unit={
                        <>
                          {' '}
                          <span className="fphd-table-note">({indicator.unit.label})</span>
                        </>
                      }
                    />
                  ) : null}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {periods.map((period) => (
              <tr className="govuk-table__row" key={`${period.fromDate}-${period.toDate}`}>
                <th scope="row" className="govuk-table__header">
                  {periodLabel(period, indicator.yearType)}
                </th>
                {seriesByArea.map((areaSeries) => {
                  const observation = cell(areaSeries, period);
                  const areaBenchmark = benchmarks.get(areaSeries.data.areaCode);
                  const benchmarkObservation = areaBenchmark?.series.find(inPeriod(period));
                  const rangePeriod = areaBenchmark?.rangePeriods.find(
                    (range) => inPeriod(period)(range) && range.segment === referenceSegment,
                  );
                  return (
                    <Fragment key={areaSeries.data.areaCode}>
                      {hasCounts ? (
                        <td className="govuk-table__cell">
                          {observation?.count == null ? '-' : formatValue(observation.count)}
                        </td>
                      ) : null}
                      <td className="govuk-table__cell">
                        {observation ? (
                          <>
                            {formatCalculatedValue(observation.value)}
                            {/* The suffix belongs to a number, not to 'No data'. */}
                            {observation.value === null ? '' : valueSuffix}
                            {observation.notes.map(({ text }) => markerFor(text)).join('')}
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      {confidence === 'none' ? null : (
                        <>
                          <td className="govuk-table__cell">
                            {observation && lowerOf(observation) !== null
                              ? formatCalculatedValue(lowerOf(observation))
                              : '-'}
                          </td>
                          <td className="govuk-table__cell">
                            {observation && upperOf(observation) !== null
                              ? formatCalculatedValue(upperOf(observation))
                              : '-'}
                          </td>
                        </>
                      )}
                      {areaBenchmark ? (
                        <BenchmarkCells
                          areaName={areaSeries.data.areaName}
                          areaObservation={observation}
                          benchmarkName={areaBenchmark.name}
                          benchmarkValue={benchmarkObservation?.value ?? null}
                          confidence={confidence === '99.8' ? '99.8' : '95'}
                          format={(value) => (
                            <>
                              {formatCalculatedValue(value)}
                              {valueSuffix}
                            </>
                          )}
                          indicator={indicator}
                          rangePeriod={rangePeriod}
                          showRange={showRange}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScrollRegion>
      {noteTexts.map((text) => (
        <p className="govuk-body-s" key={text}>
          {markerFor(text)} {text}
        </p>
      ))}
    </>
  );
}

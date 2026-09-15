import { Fragment } from 'react';
import type { BenchmarkChoice } from '../comparison';
import {
  type ConfidenceLevel,
  formatCalculatedValue,
  formatValue,
  periodLabel,
  segmentLabel,
} from '../data';
import type {
  BenchmarkGeography,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorRangePeriod,
} from '../loader';
import { trendTableModel } from '../trend';
import { BenchmarkCells, BenchmarkHeaderCells } from './benchmark-cells';
import { NoteFootnotes, noteMarker } from './note-markers';
import { TableScrollRegion } from './table-scroll-region';

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
  const model = trendTableModel({
    areaData,
    benchmark,
    confidence,
    geography,
    ranges,
    regionData,
  });
  const {
    benchmarks,
    firstObservation,
    hasCounts,
    inPeriod,
    lowerOf,
    periods,
    referenceSegment,
    seriesByArea,
    upperOf,
  } = model;
  if (!firstObservation) {
    return <p className="govuk-body">No data matches the selected options.</p>;
  }
  const benchmarkColumns = 1 + (showRange ? 3 : 0);
  const cell = (areaSeries: (typeof seriesByArea)[number], period: (typeof periods)[number]) =>
    areaSeries.series.find(inPeriod(period));
  const columnsPerArea = (hasCounts ? 2 : 1) + (confidence === 'none' ? 0 : 2);
  const valueSuffix = indicator.unit.label === '%' ? '%' : '';
  // Every distinct value note gets a sequential marker, explained under the table.
  const noteTexts = [
    ...new Set(
      seriesByArea
        .flatMap(({ series }) => series)
        .flatMap(({ notes }) => notes)
        .map(({ text }) => text),
    ),
  ];

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
                            {observation.notes
                              .map(({ text }) => noteMarker(noteTexts, text))
                              .join('')}
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
      <NoteFootnotes noteTexts={noteTexts} />
    </>
  );
}

import { Button, ChartSection, Tabs } from '@fphd/ui';
import { Fragment } from 'react';
import { cleanAreaName } from './geography-display';
import {
  type ConfidenceLevel,
  comparisonAreas,
  comparisonRows,
  confidenceInterval,
  formatCalculatedValue,
  formatValue,
  latestCoreSegments,
  periodLabel,
  recentTrend,
  segmentLabel,
  trendSeries,
} from './indicator-data';
import type {
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
  SelectedIndicator,
} from './indicator-loader';

export function SegmentationTable({
  confidence,
  data,
  indicator,
}: {
  confidence: ConfidenceLevel;
  data: IndicatorAreaData;
  indicator: IndicatorDetail;
}) {
  const segments = latestCoreSegments(data.observations);
  const first = segments[0];
  if (!first) {
    return null;
  }

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {data.areaName}, {periodLabel(first)}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          <th scope="col" className="govuk-table__header">
            Segment
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {segments.map((observation) => (
          <tr className="govuk-table__row" key={segmentLabel(observation)}>
            <th scope="row" className="govuk-table__header">
              {segmentLabel(observation)}
            </th>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatValue(observation.value)}
            </td>
            {confidence === 'none' ? null : (
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {confidenceInterval(observation, confidence)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrendTable({
  areaData,
  benchmark = 'none',
  confidence,
  indicator,
}: {
  areaData: IndicatorAreaData[];
  benchmark?: string;
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
}) {
  // The prototype shows England as a column only when it is the sole area, or when it
  // is chosen as the comparison; otherwise the table belongs to the picked areas.
  const nonEngland = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  const england = areaData.filter(({ areaCode }) => areaCode === 'E92000001');
  const shownAreas =
    nonEngland.length === 0
      ? areaData
      : benchmark === 'england'
        ? [...nonEngland, ...england]
        : nonEngland;
  const seriesByArea = shownAreas
    .map((data) => ({ data, series: trendSeries(data.observations) }))
    .filter(({ series }) => series.length > 0);
  const firstObservation = seriesByArea[0]?.series[0];
  if (!firstObservation) {
    return <p className="govuk-body">No data matches the selected options.</p>;
  }

  // The prototype's layout: periods as rows, each area a column group holding its raw
  // count and calculated value, so areas sit side by side rather than stacked. The
  // period range spans every loaded area (England included), so hiding England as a
  // column never shortens the table.
  const periods = [
    ...new Map(
      areaData
        .flatMap(({ observations }) => trendSeries(observations))
        .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate))
        .map((observation) => [
          `${observation.fromDate}|${observation.toDate}`,
          { fromDate: observation.fromDate, toDate: observation.toDate },
        ]),
    ).values(),
  ];
  const cell = (areaSeries: (typeof seriesByArea)[number], period: (typeof periods)[number]) =>
    areaSeries.series.find(
      ({ fromDate, toDate }) => fromDate === period.fromDate && toDate === period.toDate,
    );
  // Indicators like life expectancy publish no raw counts; the prototype drops the
  // column rather than rendering a dash for every period.
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
      <div className="fphd-table-scroll-wrapper">
        <table className="govuk-table fphd-trend-table">
          <caption className="govuk-table__caption govuk-visually-hidden">
            {indicator.name} trends over time, {segmentLabel(firstObservation)}
          </caption>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <td />
              {seriesByArea.map(({ data }) => (
                <th
                  scope="colgroup"
                  colSpan={columnsPerArea}
                  className="govuk-table__header"
                  key={data.areaCode}
                >
                  {data.areaName}
                </th>
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
                            {valueSuffix}
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
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noteTexts.map((text) => (
        <p className="govuk-body-s" key={text}>
          {markerFor(text)} {text}
        </p>
      ))}
    </>
  );
}

export function CompareAreasTable({
  areaData,
  confidence,
  indicator,
}: {
  areaData: IndicatorAreaData[];
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
}) {
  const latestByArea = areaData
    .map((data) => ({ data, latest: trendSeries(data.observations).at(-1) }))
    .filter((entry): entry is { data: IndicatorAreaData; latest: IndicatorObservation } =>
      Boolean(entry.latest),
    );
  const first = latestByArea[0];
  if (!first) {
    return null;
  }

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {periodLabel(first.latest)}, {segmentLabel(first.latest)}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          <th scope="col" className="govuk-table__header">
            Area
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {latestByArea.map(({ data, latest }) => (
          <tr className="govuk-table__row" key={data.areaCode}>
            <th scope="row" className="govuk-table__header">
              {data.areaName}
            </th>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatValue(latest.value)}
            </td>
            {confidence === 'none' ? null : (
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {confidenceInterval(latest, confidence)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InequalitiesTable({
  confidence,
  indicator,
  observations,
}: {
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
  observations: IndicatorObservation[];
}) {
  const first = observations[0];
  if (!first) {
    return null;
  }
  const dimensionType =
    first.dimensions.find(({ dimensionClass }) => dimensionClass === 'inequality')?.type ?? '';
  const noteTexts = [
    ...new Set(observations.flatMap(({ notes }) => notes.map(({ text }) => text))),
  ];
  const markers = ['*', '**', '***', '****'];
  const markerFor = (text: string) => markers[noteTexts.indexOf(text)] ?? '*';

  return (
    <>
      <table className="govuk-table">
        <caption className="govuk-table__caption govuk-table__caption--s">
          {dimensionType}, {periodLabel(first, indicator.yearType)}
        </caption>
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th scope="col" className="govuk-table__header">
              Segment
            </th>
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              Value ({indicator.unit.name})
            </th>
            {confidence === 'none' ? null : (
              <th scope="col" className="govuk-table__header govuk-table__header--numeric">
                {confidence}% confidence interval
              </th>
            )}
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {observations.map((observation) => (
            <tr className="govuk-table__row" key={segmentLabel(observation)}>
              <th scope="row" className="govuk-table__header">
                {segmentLabel(observation)}
              </th>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {formatCalculatedValue(observation.value)}
                {observation.notes.map(({ text }) => markerFor(text)).join('')}
              </td>
              {confidence === 'none' ? null : (
                <td className="govuk-table__cell govuk-table__cell--numeric">
                  {confidenceInterval(observation, confidence)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {noteTexts.map((text) => (
        <p className="govuk-body-s" key={text}>
          {markerFor(text)} {text}
        </p>
      ))}
    </>
  );
}

/** Only shown for two or more indicators: their latest values side by side. */
export function ComparisonSection({ selected }: { selected: SelectedIndicator[] }) {
  const rows = comparisonRows(selected);
  const areas = comparisonAreas(selected[0]?.areaData ?? []).map(({ areaCode, areaName }) => ({
    areaCode,
    areaName: cleanAreaName(areaName),
  }));
  const polarities = new Map(selected.map(({ detail }) => [detail.fingertipsId, detail.polarity]));
  const trendOf = (row: (typeof rows)[number], cell: { series: (typeof rows)[number]['series'] }) =>
    recentTrend(cell.series, polarities.get(row.fingertipsId) ?? null);
  // Distinct value notes get sequential markers, listed once under the table.
  const noteTexts = [...new Set(rows.flatMap(({ cells }) => cells.flatMap(({ notes }) => notes)))];
  const markers = ['*', '**', '***', '****'];
  const markerFor = (text: string) => markers[noteTexts.indexOf(text)] ?? '*';

  const csv = () =>
    [
      [
        'Indicator',
        'Most recent period',
        ...areas.flatMap(({ areaName }) => [
          `${areaName} recent trend`,
          `${areaName} count`,
          `${areaName} calculated value`,
        ]),
      ],
      ...rows.map((row) => [
        `${row.name}${row.suffix ? ` ${row.suffix}` : ''}`,
        row.period,
        ...row.cells.flatMap((cell) => [
          trendOf(row, cell).label,
          cell.count === null ? '' : String(cell.count),
          cell.value === null ? '' : `${cell.value} ${row.unit}`,
        ]),
      ]),
    ]
      .map((line) =>
        line
          .map((field) => (/[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field))
          .join(','),
      )
      .join('\n');

  const table = (
    <>
      <div className="fphd-download-buttons">
        <Button
          onClick={() => {
            const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'compare-indicators.csv';
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          type="button"
        >
          Download this table
        </Button>
      </div>
      <div className="fphd-table-scroll-wrapper">
        <table className="govuk-table fphd-compare-table">
          <caption className="govuk-table__caption govuk-visually-hidden">
            Compare selected indicators
          </caption>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <td colSpan={2} />
              {areas.map(({ areaCode, areaName }) => (
                <th scope="colgroup" colSpan={3} className="govuk-table__header" key={areaCode}>
                  {areaName}
                </th>
              ))}
            </tr>
            <tr className="govuk-table__row">
              <th scope="col" className="govuk-table__header">
                Indicator
              </th>
              <th scope="col" className="govuk-table__header">
                Most recent period
              </th>
              {areas.map(({ areaCode }) => (
                <Fragment key={areaCode}>
                  <th scope="col" className="govuk-table__header">
                    Recent trend
                  </th>
                  <th scope="col" className="govuk-table__header">
                    Count <span className="fphd-table-note">(Raw number)</span>
                  </th>
                  <th scope="col" className="govuk-table__header">
                    Calculated value
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {rows.map((row) => (
              <tr className="govuk-table__row" key={row.key}>
                <td className="govuk-table__cell">
                  {row.name}
                  {row.suffix ? ` ${row.suffix}` : ''}
                </td>
                <td className="govuk-table__cell">{row.period || 'No data'}</td>
                {row.cells.map((cell) => {
                  const trend = trendOf(row, cell);
                  return (
                    <Fragment key={cell.areaCode}>
                      <td className="govuk-table__cell">
                        <strong className={`govuk-tag govuk-tag--${trend.tone} fphd-trend-tag`}>
                          {trend.direction ? (
                            <span
                              aria-hidden="true"
                              className={`fphd-trend-tag__arrow fphd-trend-tag__arrow--${trend.direction}`}
                            />
                          ) : null}
                          <span className="fphd-trend-tag__text">{trend.label}</span>
                        </strong>
                      </td>
                      <td className="govuk-table__cell">
                        {cell.count === null ? '-' : formatValue(cell.count)}
                      </td>
                      <td className="govuk-table__cell">
                        {cell.value === null ? (
                          '-'
                        ) : (
                          <>
                            {row.unitLabel === '%'
                              ? `${formatCalculatedValue(cell.value)}%`
                              : `${formatCalculatedValue(cell.value)} ${row.unit}`}
                            {cell.notes.map((text) => (
                              <sup key={text}>{markerFor(text)}</sup>
                            ))}
                          </>
                        )}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noteTexts.map((text) => (
        <p className="govuk-body-s" key={text}>
          {markerFor(text)} {text}
        </p>
      ))}
    </>
  );

  return (
    <div className="fphd-chart-section" id="compare-indicators">
      <h2 className="govuk-heading-l">Compare selected indicators</h2>
      <Tabs
        title="Compare selected indicators data"
        items={[
          { id: 'compare-table', label: 'Table', content: table },
          {
            id: 'compare-chart',
            label: 'Chart',
            content: (
              <ChartSection
                id="compare-chart-section"
                title="Compare selected indicators"
                description="How the selected indicators compare."
              />
            ),
          },
        ]}
      />
    </div>
  );
}

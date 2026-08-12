import { A } from '@fphd/ui';
import {
  barWidth,
  type ConfidenceLevel,
  comparisonRows,
  confidenceInterval,
  formatValue,
  latestCoreSegments,
  periodLabel,
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
  confidence,
  indicator,
}: {
  areaData: IndicatorAreaData[];
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
}) {
  const seriesByArea = areaData
    .map((data) => ({ data, series: trendSeries(data.observations) }))
    .filter(({ series }) => series.length > 0);
  const firstObservation = seriesByArea[0]?.series[0];
  if (!firstObservation) {
    return null;
  }
  const multipleAreas = seriesByArea.length > 1;

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {multipleAreas ? (
          segmentLabel(firstObservation)
        ) : (
          <>
            {seriesByArea[0]?.data.areaName}, {segmentLabel(firstObservation)}
          </>
        )}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          {multipleAreas ? (
            <th scope="col" className="govuk-table__header">
              Area
            </th>
          ) : null}
          <th scope="col" className="govuk-table__header">
            Period
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Count
          </th>
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {seriesByArea.flatMap(({ data, series }) =>
          series.map((observation) => (
            <tr
              className="govuk-table__row"
              key={`${data.areaCode}-${observation.fromDate}-${observation.toDate}`}
            >
              {multipleAreas ? (
                <th scope="row" className="govuk-table__header">
                  {data.areaName}
                </th>
              ) : null}
              <th scope="row" className="govuk-table__header">
                {periodLabel(observation)}
              </th>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {formatValue(observation.value)}
              </td>
              {confidence === 'none' ? null : (
                <td className="govuk-table__cell govuk-table__cell--numeric">
                  {confidenceInterval(observation, confidence)}
                </td>
              )}
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {observation.count === null ? '—' : formatValue(observation.count)}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

export function CompareAreasTable({
  areaData,
  benchmark,
  confidence,
  indicator,
}: {
  areaData: IndicatorAreaData[];
  benchmark: string;
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
          {benchmark ? (
            <th scope="col" className="govuk-table__header">
              Compared with {benchmark}
            </th>
          ) : null}
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
            {benchmark ? (
              <td className="govuk-table__cell">
                {/* Significance against the benchmark is a calculation the service does
                    not perform yet, so the column states what it will compare, not a
                    verdict it cannot support. */}
                <span className="govuk-hint">Comparison to follow</span>
              </td>
            ) : null}
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

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {dimensionType}, {periodLabel(first)}
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

/** Only shown for two or more indicators: their latest values side by side. */
export function ComparisonSection({ selected }: { selected: SelectedIndicator[] }) {
  const rows = comparisonRows(selected);
  const areaName = rows.find((row) => row.areaName)?.areaName;

  return (
    <div className="fphd-chart-section" id="compare-indicators">
      <h2 className="govuk-heading-l">Compare selected indicators</h2>
      <table className="govuk-table">
        {areaName ? (
          <caption className="govuk-table__caption govuk-table__caption--s">{areaName}</caption>
        ) : null}
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th scope="col" className="govuk-table__header">
              Indicator
            </th>
            <th scope="col" className="govuk-table__header">
              Most recent period
            </th>
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              Count
            </th>
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {rows.map((row) => (
            <tr className="govuk-table__row" key={row.fingertipsId}>
              <th scope="row" className="govuk-table__header">
                <A href={`#indicator-${row.fingertipsId}`}>{row.name}</A>
                {row.segment ? <span className="govuk-hint"> {row.segment}</span> : null}
              </th>
              <td className="govuk-table__cell">{row.period || 'No data'}</td>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {row.count === null ? '—' : formatValue(row.count)}
              </td>
              <td className="govuk-table__cell">
                {row.value === null ? (
                  'No data'
                ) : (
                  <span className="fphd-bar-container">
                    <span
                      aria-hidden="true"
                      className="fphd-bar"
                      // Indicators use different units, so each bar is scaled against the
                      // largest value sharing its unit — never across unrelated scales.
                      style={{ width: `${barWidth(row, rows)}%` }}
                    />
                    <span>
                      {formatValue(row.value)} {row.unit}
                    </span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

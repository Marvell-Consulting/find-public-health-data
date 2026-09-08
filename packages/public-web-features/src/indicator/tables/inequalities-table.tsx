import {
  type ConfidenceLevel,
  confidenceInterval,
  formatCalculatedValue,
  inequalityCategoryLabel,
  periodLabel,
  segmentLabel,
} from '../data';
import type { IndicatorDetail, IndicatorObservation } from '../loader';

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
          {inequalityCategoryLabel(dimensionType)}, {periodLabel(first, indicator.yearType)}
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
                {/* The category value alone — baseline dimensions describe the whole table. */}
                {observation.dimensions.find(({ type }) => type === dimensionType)?.value ??
                  segmentLabel(observation)}
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

import { TableScrollRegion } from '@fphd/ui';
import { indicatorPath } from '@fphd/utils/indicator-path';
import { memo } from 'react';
import { Link } from 'react-router';
import { formatCalculatedValue } from '../../indicator/data.ts';
import { NoteFootnotes, noteMarker } from '../../indicator/tables/note-markers.tsx';
import { JUDGEMENT_LABELS } from '../data.ts';
import type { TopicAreaTableModel } from '../table-models.ts';

export const AreaSummariesTable = memo(function AreaSummariesTable({
  model,
}: {
  model: TopicAreaTableModel;
}) {
  const { areas: pickedAreas, rows } = model;
  const noteTexts = [
    ...new Set(
      rows.flatMap((row) => [...row.cells.flatMap(({ notes }) => notes), ...row.england.notes]),
    ),
  ];
  return (
    <>
      <ul className="govuk-list fphd-rug-key" aria-label="Comparison key">
        {Object.entries(JUDGEMENT_LABELS)
          .filter(([key]) => ['better', 'similar', 'worse', 'none'].includes(key))
          .map(([judgement, label]) => (
            <li key={judgement}>
              <span
                className={`fphd-rug-key__swatch fphd-rug-cell--${judgement}`}
                aria-hidden="true"
              />
              {judgement === 'none'
                ? 'Not compared (higher or lower is neither better nor worse)'
                : label}
            </li>
          ))}
        <li>No data</li>
      </ul>
      <TableScrollRegion label="Topic indicators by area">
        <table className="govuk-table fphd-compare-table fphd-rug-table">
          <caption className="govuk-visually-hidden">Topic indicators by area</caption>
          <colgroup>
            <col />
            <col />
            {Array.from({ length: pickedAreas.length + 1 }, (_, index) => (
              <col key={index} />
            ))}
          </colgroup>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th className="govuk-table__header" scope="col">
                Indicator
              </th>
              <th className="govuk-table__header" scope="col">
                Latest period
              </th>
              <th className="govuk-table__header" scope="col">
                England
              </th>
              {pickedAreas.map(({ areaCode, areaName }) => (
                <th className="govuk-table__header" scope="col" key={areaCode}>
                  {areaName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {rows.map((row) => {
              const england = row.england;
              const englandPeriod = england.period;
              return (
                <tr className="govuk-table__row" key={row.key}>
                  <td className="govuk-table__cell">
                    <Link className="govuk-link" to={indicatorPath(row.slug)}>
                      {row.name}
                    </Link>
                    {row.suffix ? ` ${row.suffix}` : ''}
                    {row.subtopics.map((subtopic) => (
                      <span className="fphd-rug-cell__label fphd-topic-subtopic" key={subtopic}>
                        {subtopic}
                      </span>
                    ))}
                    <span className="fphd-rug-cell__label">Unit: {row.unit}</span>
                  </td>
                  <td className="govuk-table__cell">{row.period || 'No data'}</td>
                  <td className="govuk-table__cell">
                    {england?.value == null ? (
                      'No data'
                    ) : (
                      <>
                        {formatCalculatedValue(england.value)}
                        {england.notes.map((text) => (
                          <sup key={text}>{noteMarker(noteTexts, text)}</sup>
                        ))}
                      </>
                    )}
                    {englandPeriod !== row.period && england?.value != null ? (
                      <span className="fphd-rug-cell__label">{englandPeriod}</span>
                    ) : null}
                  </td>
                  {row.cells.map((cell) => {
                    const { judgement, period } = cell;
                    return (
                      <td
                        className={`govuk-table__cell${cell.value === null ? '' : ` fphd-rug-cell--${judgement}`}`}
                        key={cell.areaCode}
                      >
                        {cell.value === null ? (
                          'No data'
                        ) : (
                          <>
                            {formatCalculatedValue(cell.value)}
                            {cell.notes.map((text) => (
                              <sup key={text}>{noteMarker(noteTexts, text)}</sup>
                            ))}
                            <span
                              className={
                                judgement === 'none'
                                  ? 'govuk-visually-hidden'
                                  : 'fphd-rug-cell__label'
                              }
                            >
                              {judgement === 'none'
                                ? 'No comparison'
                                : judgement.charAt(0).toUpperCase() + judgement.slice(1)}
                              {judgement !== 'none' ? (
                                <span className="govuk-visually-hidden">
                                  {judgement === 'similar' ? ' to England' : ' than England'}
                                </span>
                              ) : null}
                            </span>
                            {period !== row.period ? (
                              <span className="fphd-rug-cell__label">{period}</span>
                            ) : null}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableScrollRegion>
      <NoteFootnotes noteTexts={noteTexts} />
    </>
  );
});

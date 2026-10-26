import { TableScrollRegion } from '@fphd/ui';
import { indicatorPath } from '@fphd/utils/indicator-path';
import { Link } from 'react-router';
import { comparisonTable } from '../../indicator/comparison.ts';
import { formatCalculatedValue } from '../../indicator/data.ts';
import type { BenchmarkGeography, SelectedIndicator } from '../../indicator/loader.ts';
import { NoteFootnotes, noteMarker } from '../../indicator/tables/note-markers.tsx';
import {
  englandObservation,
  JUDGEMENT_LABELS,
  observationPeriod,
  topicJudgement,
  topicSubtopics,
} from '../data.ts';

export function AreaSummariesTable({
  selected,
  geography,
  topicSlug,
}: {
  selected: SelectedIndicator[];
  geography: BenchmarkGeography;
  topicSlug: string;
}) {
  const { areas, rows, benchmarkCellFor } = comparisonTable(selected, geography, 'england');
  const pickedAreas = areas.filter(({ areaCode }) => areaCode !== 'E92000001');
  const byId = new Map(selected.map((entry) => [entry.detail.shortId, entry]));
  const noteTexts = [
    ...new Set(
      rows.flatMap((row) => [
        ...row.cells.flatMap(({ notes }) => notes),
        ...(englandObservation(byId.get(row.shortId) as SelectedIndicator, row)?.notes.map(
          ({ text }) => text,
        ) ?? []),
      ]),
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
              const entry = byId.get(row.shortId);
              if (!entry) return null;
              const england = englandObservation(entry, row);
              const englandPeriod = observationPeriod(entry, england);
              return (
                <tr className="govuk-table__row" key={row.key}>
                  <td className="govuk-table__cell">
                    <Link className="govuk-link" to={indicatorPath(entry.detail.slug)}>
                      {row.name}
                    </Link>
                    {row.suffix ? ` ${row.suffix}` : ''}
                    {topicSubtopics(entry, topicSlug).map((subtopic) => (
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
                        {england.notes.map(({ text }) => (
                          <sup key={text}>{noteMarker(noteTexts, text)}</sup>
                        ))}
                      </>
                    )}
                    {englandPeriod !== row.period && england?.value != null ? (
                      <span className="fphd-rug-cell__label">{englandPeriod}</span>
                    ) : null}
                  </td>
                  {row.cells
                    .filter(({ areaCode }) => areaCode !== 'E92000001')
                    .map((cell) => {
                      const benchmark = benchmarkCellFor(row, cell);
                      const judgement = topicJudgement(
                        benchmark?.areaObservation,
                        benchmark?.value ?? null,
                        entry.detail,
                      );
                      const period = observationPeriod(entry, cell.series.at(-1));
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
}

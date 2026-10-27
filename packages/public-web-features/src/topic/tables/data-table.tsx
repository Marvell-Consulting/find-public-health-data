import { formatDate, TableScrollRegion } from '@fphd/ui';
import { indicatorPath } from '@fphd/utils/indicator-path';
import { memo } from 'react';
import { Link } from 'react-router';
import { formatCalculatedValue, formatValue, recentTrend, withUnit } from '../../indicator/data.ts';
import { TrendTag } from '../../indicator/trend-tag.tsx';
import type { TopicColumn } from '../data.ts';
import type { TopicDataTableModel } from '../table-models.ts';

export const TopicDataTable = memo(function TopicDataTable({
  model,
  title,
  columns = ['period', 'updated', 'trend', 'value'],
}: {
  model: TopicDataTableModel;
  title: string;
  columns?: TopicColumn[];
}) {
  const { rows, areas } = model;
  const measures = columns.filter(
    (column) =>
      column === 'trend' || column === 'count' || column === 'numerator' || column === 'value',
  );
  return (
    <TableScrollRegion label={`${title} indicators comparison table`}>
      <table className="govuk-table fphd-compare-table fphd-topic-data-table">
        <caption className="govuk-visually-hidden">
          {title} indicators for {areas.map(({ name }) => name).join(', ') || 'England'}
        </caption>
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th className="govuk-table__header" scope="col" rowSpan={measures.length ? 2 : 1}>
              Indicator
            </th>
            {columns.includes('period') ? (
              <th
                className="govuk-table__header fphd-topic-data-table__period"
                scope="col"
                rowSpan={measures.length ? 2 : 1}
              >
                Most recent
                <br />
                period
              </th>
            ) : null}
            {columns.includes('updated') ? (
              <th
                className="govuk-table__header fphd-topic-data-table__updated"
                scope="col"
                rowSpan={measures.length ? 2 : 1}
              >
                Last
                <br />
                updated
              </th>
            ) : null}
            {measures.length
              ? areas.map((area) => (
                  <th
                    key={area.code}
                    scope="colgroup"
                    colSpan={measures.length}
                    className="govuk-table__header"
                  >
                    {area.name}
                  </th>
                ))
              : null}
          </tr>
          {measures.length ? (
            <tr className="govuk-table__row">
              {areas.flatMap((area) =>
                measures.map((measure) => (
                  <th key={`${area.code}-${measure}`} scope="col" className="govuk-table__header">
                    {measure === 'trend' ? (
                      <>
                        Trend
                        <br />
                        (last 5 periods)
                      </>
                    ) : measure === 'count' ? (
                      'Count'
                    ) : measure === 'numerator' ? (
                      'Numerator'
                    ) : (
                      <>
                        Calculated
                        <br />
                        value
                      </>
                    )}
                  </th>
                )),
              )}
            </tr>
          ) : null}
        </thead>
        <tbody className="govuk-table__body">
          {rows.map((row) => {
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
                </td>
                {columns.includes('period') ? (
                  <td className="govuk-table__cell">{row.period || 'No data'}</td>
                ) : null}
                {columns.includes('updated') ? (
                  <td className="govuk-table__cell">
                    {row.updatedAt ? formatDate(row.updatedAt, 'short') : 'Not known'}
                  </td>
                ) : null}
                {areas.flatMap((area) =>
                  measures.map((measure) => {
                    const cell = row.cells.find(({ areaCode }) => areaCode === area.code);
                    return (
                      <td key={`${area.code}-${measure}`} className="govuk-table__cell">
                        {measure === 'trend' ? (
                          <TrendTag trend={cell?.trend ?? recentTrend([], null)} />
                        ) : measure === 'count' || measure === 'numerator' ? (
                          cell?.[measure] == null ? (
                            'No data'
                          ) : (
                            formatValue(cell[measure])
                          )
                        ) : cell?.value == null ? (
                          'No data'
                        ) : (
                          withUnit(formatCalculatedValue(cell.value), row.unit)
                        )}
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScrollRegion>
  );
});

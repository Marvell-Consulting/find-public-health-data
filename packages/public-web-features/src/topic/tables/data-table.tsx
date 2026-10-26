import { formatDate, TableScrollRegion } from '@fphd/ui';
import { indicatorPath } from '@fphd/utils/indicator-path';
import { Link } from 'react-router';
import {
  comparisonRows,
  formatCalculatedValue,
  formatValue,
  recentTrend,
  withUnit,
} from '../../indicator/data.ts';
import type { SelectedIndicator } from '../../indicator/loader.ts';
import { TrendTag } from '../../indicator/trend-tag.tsx';
import { type TopicColumn, topicSubtopics } from '../data.ts';

export function TopicDataTable({
  selected,
  title,
  topicSlug,
  columns = ['period', 'updated', 'trend', 'value'],
}: {
  selected: SelectedIndicator[];
  title: string;
  topicSlug: string;
  columns?: TopicColumn[];
}) {
  const byId = new Map(selected.map((entry) => [entry.detail.shortId, entry]));
  const rows = comparisonRows(selected);
  const areas = [
    ...new Map(
      rows.flatMap((row) => row.cells.map((cell) => [cell.areaCode, cell.areaName] as const)),
    ).entries(),
  ]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) =>
      a.code === 'E92000001' ? -1 : b.code === 'E92000001' ? 1 : a.name.localeCompare(b.name),
    );
  const measures = columns.filter(
    (column) => column === 'trend' || column === 'count' || column === 'value',
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
            const entry = byId.get(row.shortId);
            if (!entry) return null;
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
                </td>
                {columns.includes('period') ? (
                  <td className="govuk-table__cell">{row.period || 'No data'}</td>
                ) : null}
                {columns.includes('updated') ? (
                  <td className="govuk-table__cell">
                    {entry.detail.dataUpdatedAt
                      ? formatDate(entry.detail.dataUpdatedAt, 'short')
                      : 'Not known'}
                  </td>
                ) : null}
                {areas.flatMap((area) =>
                  measures.map((measure) => {
                    const cell = row.cells.find(({ areaCode }) => areaCode === area.code);
                    const latest = cell?.series.at(-1);
                    return (
                      <td key={`${area.code}-${measure}`} className="govuk-table__cell">
                        {measure === 'trend' ? (
                          <TrendTag
                            trend={recentTrend(cell?.series ?? [], entry.detail.polarity)}
                          />
                        ) : measure === 'count' ? (
                          latest?.count == null ? (
                            'No data'
                          ) : (
                            formatValue(latest.count)
                          )
                        ) : latest?.value == null ? (
                          'No data'
                        ) : (
                          withUnit(formatCalculatedValue(latest.value), entry.detail.unit)
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
}

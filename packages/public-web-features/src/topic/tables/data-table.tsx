import { formatDate, TableScrollRegion } from '@fphd/ui';
import { indicatorPath } from '@fphd/utils/indicator-path';
import { Link } from 'react-router';
import {
  comparisonRows,
  formatCalculatedValue,
  recentTrend,
  withUnit,
} from '../../indicator/data.ts';
import type { SelectedIndicator } from '../../indicator/loader.ts';
import { TrendTag } from '../../indicator/trend-tag.tsx';

export function TopicDataTable({
  selected,
  title,
}: {
  selected: SelectedIndicator[];
  title: string;
}) {
  const byId = new Map(selected.map((entry) => [entry.detail.shortId, entry]));
  const rows = comparisonRows(selected);
  return (
    <TableScrollRegion label={`${title} indicators comparison table`}>
      <table className="govuk-table fphd-compare-table fphd-topic-data-table">
        <caption className="govuk-visually-hidden">{title} indicators for England</caption>
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th className="govuk-table__header" scope="col">
              Indicator
            </th>
            <th className="govuk-table__header" scope="col">
              Most recent period
            </th>
            <th className="govuk-table__header" scope="col">
              Last updated
            </th>
            <th className="govuk-table__header" scope="col">
              Trend (last 5 periods)
            </th>
            <th className="govuk-table__header" scope="col">
              Calculated value
            </th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {rows.map((row) => {
            const entry = byId.get(row.shortId);
            if (!entry) return null;
            const england = row.cells.find(({ areaCode }) => areaCode === 'E92000001');
            const latest = england?.series.at(-1);
            return (
              <tr className="govuk-table__row" key={row.key}>
                <td className="govuk-table__cell">
                  <Link className="govuk-link" to={indicatorPath(entry.detail.slug)}>
                    {row.name}
                  </Link>
                  {row.suffix ? ` ${row.suffix}` : ''}
                </td>
                <td className="govuk-table__cell">{row.period || 'No data'}</td>
                <td className="govuk-table__cell">
                  {entry.detail.dataUpdatedAt
                    ? formatDate(entry.detail.dataUpdatedAt, 'short')
                    : 'Not known'}
                </td>
                <td className="govuk-table__cell">
                  <TrendTag trend={recentTrend(england?.series ?? [], entry.detail.polarity)} />
                </td>
                <td className="govuk-table__cell">
                  {latest?.value == null
                    ? 'No data'
                    : withUnit(formatCalculatedValue(latest.value), entry.detail.unit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScrollRegion>
  );
}

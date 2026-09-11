import { Button, ChartSection, Tabs } from '@fphd/ui';
import { Fragment, useState } from 'react';
import { useLocation } from 'react-router';
import {
  comparisonAreas,
  comparisonRows,
  filterObservations,
  formatCalculatedValue,
  formatValue,
  recentTrend,
  segmentValuesKey,
  trendSeries,
} from '../data';
import type { BenchmarkGeography, SelectedIndicator } from '../loader';
import { type PanelOptions, PanelOptionsPanel, useOptionParamNavigation } from '../options';
import { BenchmarkCells, BenchmarkHeaderCells } from './benchmark-cells';
import { NoteFootnotes, noteMarker } from './note-markers';
import { TableScrollRegion } from './table-scroll-region';

/** Only shown for two or more indicators: their latest values side by side. */
export function ComparisonSection({
  selected,
  geography = { regionByCode: {}, levelByCode: {} },
}: {
  selected: SelectedIndicator[];
  geography?: BenchmarkGeography;
}) {
  const location = useLocation();
  const applyOptionParams = useOptionParamNavigation();
  // The compare table's own option params, suffixed like the per-indicator ones.
  const params = new URLSearchParams(location.search);
  const [options, setOptions] = useState<PanelOptions>(() => {
    const cmp = params.get('cmp-compare');
    return {
      benchmark: cmp === 'england' || cmp === 'region' ? cmp : 'none',
      confidence: 'none',
      periodType: 'all',
      range: params.get('cr-compare') === 'yes',
      sex: '',
    };
  });
  const applyOptions = (next: PanelOptions) => {
    setOptions(next);
    applyOptionParams([
      ['cmp-compare', next.benchmark, 'none'],
      ['cr-compare', next.range ? 'yes' : '', ''],
    ]);
  };

  const rows = comparisonRows(selected);
  const areas = comparisonAreas(selected[0]?.areaData ?? []).map(({ areaCode, areaName }) => ({
    areaCode,
    areaName: areaName,
  }));
  const byId = new Map(selected.map((entry) => [entry.detail.fingertipsId, entry]));
  const polarities = new Map(selected.map(({ detail }) => [detail.fingertipsId, detail.polarity]));
  const trendOf = (row: (typeof rows)[number], cell: { series: (typeof rows)[number]['series'] }) =>
    recentTrend(cell.series, polarities.get(row.fingertipsId) ?? null);
  // Distinct value notes get sequential markers, listed once under the table.
  const noteTexts = [...new Set(rows.flatMap(({ cells }) => cells.flatMap(({ notes }) => notes)))];

  const hasPickedAreas = areas.some(({ areaCode }) => areaCode !== 'E92000001');
  const regionAvailable = areas.some(({ areaCode }) => geography.regionByCode[areaCode]);
  const benchmark = hasPickedAreas ? options.benchmark : 'none';
  const benchmarkActive = benchmark !== 'none';
  const benchmarkColumns = 1 + (options.range ? 3 : 0);
  const benchmarkNameFor = (areaCode: string): string | undefined => {
    if (!benchmarkActive) {
      return undefined;
    }
    if (benchmark === 'england') {
      return 'England';
    }
    const region = geography.regionByCode[areaCode];
    return region ? `${region.name} (Statistical region)` : undefined;
  };
  // The benchmark filtered the way the breakout row is — never all-persons beside a sexed row.
  const benchmarkCellFor = (
    row: (typeof rows)[number],
    cell: (typeof rows)[number]['cells'][number],
  ) => {
    const entry = byId.get(row.fingertipsId);
    const latest = cell.series.at(-1);
    if (!entry || !latest || !benchmarkNameFor(cell.areaCode)) {
      return undefined;
    }
    const source =
      benchmark === 'england'
        ? entry.areaData.find(({ areaCode }) => areaCode === 'E92000001')
        : (entry.regionData ?? []).find(
            ({ areaCode }) => areaCode === geography.regionByCode[cell.areaCode]?.code,
          );
    const series = source
      ? trendSeries(
          filterObservations(source.observations, { sex: row.sex, periodType: row.periodType }),
        )
      : [];
    const samePeriod = ({ fromDate, toDate }: { fromDate: string; toDate: string }) =>
      fromDate === latest.fromDate && toDate === latest.toDate;
    const rangeKey =
      benchmark === 'england'
        ? (geography.levelByCode[cell.areaCode] ?? '')
        : 'Statistical regions';
    return {
      value: series.find(samePeriod)?.value ?? null,
      // The range must describe the segment the row shows, not another population's spread.
      rangePeriod: (entry.ranges?.[rangeKey] ?? []).find(
        (range) => samePeriod(range) && range.segment === segmentValuesKey(latest),
      ),
      areaObservation: latest,
      detail: entry.detail,
    };
  };
  const withUnit = (row: (typeof rows)[number], value: number) =>
    row.unitLabel === '%'
      ? `${formatCalculatedValue(value)}%`
      : `${formatCalculatedValue(value)} ${row.unit}`;

  const csv = () =>
    [
      [
        'Indicator',
        'Most recent period',
        ...areas.flatMap(({ areaCode, areaName }) => [
          `${areaName} recent trend`,
          `${areaName} count`,
          `${areaName} calculated value`,
          ...(benchmarkNameFor(areaCode)
            ? [
                `${areaName} ${benchmarkNameFor(areaCode)} calculated value`,
                ...(options.range
                  ? [
                      `${areaName} ${benchmarkNameFor(areaCode)} minimum`,
                      `${areaName} ${benchmarkNameFor(areaCode)} maximum`,
                    ]
                  : []),
              ]
            : []),
        ]),
      ],
      ...rows.map((row) => [
        `${row.name}${row.suffix ? ` ${row.suffix}` : ''}`,
        row.period,
        ...row.cells.flatMap((cell) => {
          const benchmarkCell = benchmarkNameFor(cell.areaCode)
            ? benchmarkCellFor(row, cell)
            : undefined;
          return [
            trendOf(row, cell).label,
            cell.count === null ? '' : String(cell.count),
            cell.value === null ? '' : `${cell.value} ${row.unit}`,
            ...(benchmarkNameFor(cell.areaCode)
              ? [
                  benchmarkCell?.value == null ? '' : `${benchmarkCell.value} ${row.unit}`,
                  ...(options.range
                    ? [
                        benchmarkCell?.rangePeriod ? String(benchmarkCell.rangePeriod.min) : '',
                        benchmarkCell?.rangePeriod ? String(benchmarkCell.rangePeriod.max) : '',
                      ]
                    : []),
                ]
              : []),
          ];
        }),
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
      {hasPickedAreas ? (
        <PanelOptionsPanel
          benchmarks={{ region: regionAvailable }}
          confidenceLevels={[]}
          label="Table options"
          onChange={applyOptions}
          options={options}
          periodTypes={[]}
          sexes={[]}
          showConfidence={false}
        />
      ) : null}
      <TableScrollRegion label="Compare selected indicators">
        <table className="govuk-table fphd-compare-table">
          <caption className="govuk-table__caption govuk-visually-hidden">
            Compare selected indicators
          </caption>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <td colSpan={2} />
              {areas.map(({ areaCode, areaName }) => (
                <Fragment key={areaCode}>
                  <th scope="colgroup" colSpan={3} className="govuk-table__header">
                    {areaName}
                  </th>
                  {benchmarkNameFor(areaCode) ? (
                    <th
                      scope="colgroup"
                      colSpan={benchmarkColumns}
                      className="govuk-table__header fphd-trend-table__benchmark-group"
                    >
                      {benchmarkNameFor(areaCode)}
                    </th>
                  ) : null}
                </Fragment>
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
                  {benchmarkNameFor(areaCode) ? (
                    <BenchmarkHeaderCells showRange={options.range} />
                  ) : null}
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
                            {withUnit(row, cell.value)}
                            {cell.notes.map((text) => (
                              <sup key={text}>{noteMarker(noteTexts, text)}</sup>
                            ))}
                          </>
                        )}
                      </td>
                      {benchmarkNameFor(cell.areaCode)
                        ? (() => {
                            const benchmarkCell = benchmarkCellFor(row, cell);
                            return (
                              <BenchmarkCells
                                areaName={cell.areaName}
                                areaObservation={benchmarkCell?.areaObservation}
                                benchmarkName={benchmarkNameFor(cell.areaCode) ?? ''}
                                benchmarkValue={benchmarkCell?.value ?? null}
                                format={(value) => withUnit(row, value)}
                                indicator={
                                  benchmarkCell?.detail ?? { polarity: '', comparatorMethod: null }
                                }
                                rangePeriod={benchmarkCell?.rangePeriod}
                                showRange={options.range}
                              />
                            );
                          })()
                        : null}
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

  return (
    <div className="fphd-chart-section" id="compare-indicators">
      <h2 className="govuk-heading-l">Compare selected indicators</h2>
      <Tabs
        paramKey="tab-compare"
        title="Compare selected indicators data"
        items={[
          { id: 'compare-table', param: 'table', label: 'Table', content: table },
          {
            id: 'compare-chart',
            param: 'chart',
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

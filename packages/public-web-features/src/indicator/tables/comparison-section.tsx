import { Button, ChartSection, Tabs } from '@fphd/ui';
import { Fragment } from 'react';
import { Form } from 'react-router';
import { comparisonTable } from '../comparison.js';
import { formatCalculatedValue, formatValue } from '../data.js';
import type { BenchmarkGeography, SelectedIndicator } from '../loader.js';
import { PanelOptionsPanel, usePanelOptions } from '../options.js';
import { TrendTag } from '../trend-tag.js';
import { BenchmarkCells, BenchmarkHeaderCells } from './benchmark-cells.js';
import { NoteFootnotes, noteMarker } from './note-markers.js';
import { TableScrollRegion } from './table-scroll-region.js';

/** Only shown for two or more indicators: their latest values side by side. */
export function ComparisonSection({
  selected,
  geography = { regionByCode: {}, levelByCode: {} },
}: {
  selected: SelectedIndicator[];
  geography?: BenchmarkGeography;
}) {
  const [options, applyOptions] = usePanelOptions('compare');
  const {
    areas,
    rows,
    trendOf,
    hasPickedAreas,
    regionAvailable,
    benchmarkNameFor,
    benchmarkCellFor,
  } = comparisonTable(selected, geography, options.benchmark);
  // Distinct value notes get sequential markers, listed once under the table.
  const noteTexts = [...new Set(rows.flatMap(({ cells }) => cells.flatMap(({ notes }) => notes)))];

  const benchmarkColumns = 1 + (options.range ? 3 : 0);
  const withUnit = (row: (typeof rows)[number], value: number) =>
    row.unitLabel === '%'
      ? `${formatCalculatedValue(value)}%`
      : `${formatCalculatedValue(value)} ${row.unit}`;

  const downloadParams = new URLSearchParams();
  for (const { detail } of selected) downloadParams.append('is', String(detail.shortId));
  for (const { areaCode } of areas) downloadParams.append('as', areaCode);
  downloadParams.set('cmp-compare', options.benchmark);
  downloadParams.set('cr-compare', options.range ? 'yes' : 'no');

  const table = (
    <>
      <div className="fphd-download-buttons">
        <Form action="/indicators/compare.csv" method="get" reloadDocument>
          {[...downloadParams].map(([name, value], index) => (
            <input key={`${name}-${index}`} name={name} type="hidden" value={value} />
          ))}
          <Button type="submit">Download this table</Button>
        </Form>
      </div>
      {hasPickedAreas ? (
        <PanelOptionsPanel
          benchmarks={{ region: regionAvailable }}
          confidenceLevels={[]}
          label="Table options"
          onChange={applyOptions}
          options={options}
          periodTypes={[]}
          scope="compare"
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
                        <TrendTag trend={trend} />
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

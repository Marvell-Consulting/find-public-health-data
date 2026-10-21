import { Button, ChartSection, Tabs } from '@fphd/ui';
import { Form } from 'react-router';
import { comparisonTable } from '../comparison.ts';
import type { BenchmarkGeography, SelectedIndicator } from '../loader.ts';
import { PanelOptionsPanel, usePanelOptions } from '../options.tsx';
import { ComparisonTable } from './comparison-table.tsx';

/** Only shown for two or more indicators: their latest values side by side. */
export function ComparisonSection({
  selected,
  geography = { regionByCode: {}, levelByCode: {} },
}: {
  selected: SelectedIndicator[];
  geography?: BenchmarkGeography;
}) {
  const [options, applyOptions] = usePanelOptions('compare');
  const { areas, hasPickedAreas, regionAvailable } = comparisonTable(
    selected,
    geography,
    options.benchmark,
  );
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
      <ComparisonTable
        selected={selected}
        geography={geography}
        benchmark={options.benchmark}
        showRange={options.range}
      />
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

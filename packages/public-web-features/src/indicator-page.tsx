import { A, BackLink, ChartSection, GridColumn, GridRow, PageIntro, Tabs } from '@fphd/ui';
import { useState } from 'react';

import {
  dimensionValues,
  filterObservations,
  inequalityBreakdown,
  inequalityCategories,
  inequalityPeriods,
} from './indicator-data';
import { FilterPane } from './indicator-filter-pane';
import type {
  AreaGroup,
  IndicatorSelection,
  IndicatorSummary as IndicatorSummaryData,
  SelectedIndicator,
} from './indicator-loader';
import { BackgroundInformation, IndicatorSummary } from './indicator-metadata';
import { InequalityOptions, type PanelOptions, PanelOptionsPanel } from './indicator-options';
import {
  CompareAreasTable,
  ComparisonSection,
  InequalitiesTable,
  SegmentationTable,
  TrendTable,
} from './indicator-tables';

/**
 * Everything shown for one selected indicator, repeated per selection: the summary
 * table, then the prototype's Chart / Table / Inequalities / About tab set.
 */
function IndicatorBlock({ detail, areaData }: SelectedIndicator) {
  const id = detail.fingertipsId;
  const [options, setOptions] = useState<PanelOptions>({
    benchmark: 'England',
    confidence: '95',
    periodType: 'all',
    sex: '',
  });

  const allObservations = areaData[0]?.observations ?? [];
  const sexes = dimensionValues(allObservations, 'Sex');
  const categories = inequalityCategories(allObservations);
  const [category, setCategory] = useState(categories[0] ?? '');
  const periods = inequalityPeriods(allObservations, category);
  const [period, setPeriod] = useState(periods.at(-1)?.value ?? '');

  const filtered = areaData.map((data) => ({
    ...data,
    observations: filterObservations(data.observations, {
      sex: options.sex,
      periodType: options.periodType,
    }),
  }));
  // Benchmarks come from the area types the indicator publishes against; England is the
  // default comparison the prototype offers alongside them.
  const benchmarks = ['England', ...detail.areaTypes.map(({ name }) => name)].filter(
    (name, index, all) => all.indexOf(name) === index,
  );

  const panelOptions = (label: string, showConfidence: boolean) => (
    <PanelOptionsPanel
      benchmarks={benchmarks}
      label={label}
      onChange={setOptions}
      options={options}
      sexes={sexes}
      showConfidence={showConfidence}
    />
  );

  return (
    <section className="fphd-indicator-section" aria-labelledby={`indicator-${id}`}>
      <h2 className="govuk-heading-l" id={`indicator-${id}`}>
        {detail.name}
      </h2>
      <IndicatorSummary indicator={detail} observations={allObservations} />

      <Tabs
        title={`${detail.name} data`}
        items={[
          {
            id: `chart-${id}`,
            label: 'Chart',
            content: (
              <>
                {panelOptions('Chart options', false)}
                <ChartSection
                  id={`trends-${id}`}
                  title="Indicator trends over time"
                  description="How this indicator has changed over time."
                />
              </>
            ),
          },
          {
            id: `table-${id}`,
            label: 'Table',
            content: (
              <>
                {panelOptions('Table options', true)}
                <h3 className="govuk-heading-m">Indicator trends over time</h3>
                <TrendTable
                  indicator={detail}
                  areaData={filtered}
                  confidence={options.confidence}
                />
                <h3 className="govuk-heading-m">Compare areas for one time period</h3>
                <CompareAreasTable
                  indicator={detail}
                  areaData={filtered}
                  benchmark={options.benchmark}
                  confidence={options.confidence}
                />
                <h3 className="govuk-heading-m">Indicator segmentations overview</h3>
                {filtered[0] ? (
                  <SegmentationTable
                    indicator={detail}
                    data={filtered[0]}
                    confidence={options.confidence}
                  />
                ) : null}
              </>
            ),
          },
          {
            id: `inequalities-${id}`,
            label: 'Inequalities',
            content:
              categories.length === 0 ? (
                <p className="govuk-body">
                  This indicator has no inequality breakdowns for the selected areas.
                </p>
              ) : (
                <>
                  <InequalityOptions
                    categories={categories}
                    category={category}
                    confidence={options.confidence}
                    onCategoryChange={(value) => {
                      setCategory(value);
                      // The chosen period may not exist for the new category.
                      setPeriod(inequalityPeriods(allObservations, value).at(-1)?.value ?? '');
                    }}
                    onConfidenceChange={(confidence) => setOptions({ ...options, confidence })}
                    onPeriodChange={setPeriod}
                    period={period}
                    periods={periods}
                  />
                  <ChartSection
                    id={`inequalities-chart-${id}`}
                    title="Inequalities"
                    description={`How ${detail.name.toLowerCase()} varies by ${category.toLowerCase()}.`}
                  />
                  <InequalitiesTable
                    indicator={detail}
                    confidence={options.confidence}
                    observations={inequalityBreakdown(allObservations, category, period)}
                  />
                </>
              ),
          },
          {
            id: `about-${id}`,
            label: 'About this indicator',
            content: <BackgroundInformation indicator={detail} />,
          },
        ]}
      />
    </section>
  );
}

export function IndicatorPage({
  selected,
  areaGroups,
  availableIndicators,
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  availableIndicators: IndicatorSummaryData[];
  selection: IndicatorSelection;
}) {
  return (
    <>
      <BackLink href="/" />
      <GridRow>
        <GridColumn width="one-quarter">
          <FilterPane
            key={`${selection.fingertipsIds.join(',')}|${selection.areaType}|${selection.areaCodes.join(',')}`}
            selected={selected}
            areaGroups={areaGroups}
            availableIndicators={availableIndicators}
            selection={selection}
          />
        </GridColumn>
        <GridColumn width="three-quarters">
          {selected.length === 0 ? (
            <>
              <PageIntro size="l" title="Selected indicators" />
              <p className="govuk-body">
                No indicators selected. Add one from the filters to see its data.
              </p>
            </>
          ) : (
            <>
              {/* The page's heading is its contents list: the indicator names below are
                  the real headings, so a second title above them would say nothing. */}
              <nav className="govuk-!-margin-bottom-6">
                <h1 className="govuk-heading-m">Contents</h1>
                <ul className="govuk-list">
                  {selected.length > 1 ? (
                    <li>
                      <A href="#compare-indicators">Compare selected indicators</A>
                    </li>
                  ) : null}
                  {selected.map(({ detail }) => (
                    <li key={detail.fingertipsId}>
                      <A href={`#indicator-${detail.fingertipsId}`}>{detail.name}</A>
                    </li>
                  ))}
                </ul>
              </nav>

              {selected.length > 1 ? <ComparisonSection selected={selected} /> : null}

              {selected.map((entry) => (
                <IndicatorBlock key={entry.detail.fingertipsId} {...entry} />
              ))}
            </>
          )}
        </GridColumn>
      </GridRow>
    </>
  );
}

import { A, Button, ChartSection, GridColumn, GridRow, InsetText, Tabs } from '@fphd/ui';
import { useState } from 'react';
import { useLocation } from 'react-router';

import {
  availableConfidenceLevels,
  availablePeriodTypes,
  dimensionValues,
  filterObservations,
  inequalityBreakdown,
  inequalityCategories,
  inequalityPeriods,
} from './indicator-data';
import { allDataCsv, downloadCsv, trendCsv } from './indicator-download';
import { FilterPane } from './indicator-filter-pane';
import type {
  AreaGroup,
  BenchmarkGeography,
  IndicatorSelection,
  IndicatorSummary as IndicatorSummaryData,
  SelectedIndicator,
} from './indicator-loader';
import { BackgroundInformation, IndicatorSummary } from './indicator-metadata';
import {
  type BenchmarkChoice,
  InequalityOptions,
  type PanelOptions,
  PanelOptionsPanel,
  useOptionParamNavigation,
} from './indicator-options';
import { ComparisonSection, InequalitiesTable, TrendTable } from './indicator-tables';

/**
 * Everything shown for one selected indicator, repeated per selection: the summary
 * table, then the prototype's Chart / Table / Inequalities / About tab set.
 */
function IndicatorBlock({
  detail,
  areaData,
  regionData = [],
  ranges = {},
  geography,
  headingLevel: Heading = 'h2',
}: SelectedIndicator & { geography: BenchmarkGeography; headingLevel?: 'h1' | 'h2' }) {
  const id = detail.fingertipsId;
  const location = useLocation();
  const applyOptionParams = useOptionParamNavigation();
  // Suffixed option params (`ci-241`) keep each table's choices its own in a shareable URL.
  const params = new URLSearchParams(location.search);
  const [options, setOptions] = useState<PanelOptions>(() => {
    const ci = params.get(`ci-${id}`);
    const pt = params.get(`pt-${id}`);
    const cmp = params.get(`cmp-${id}`);
    return {
      benchmark: cmp === 'england' || cmp === 'region' ? (cmp as BenchmarkChoice) : 'none',
      confidence: ci === '95' || ci === '99.8' ? ci : 'none',
      periodType: pt === '1-year' || pt === '3-year' ? pt : 'all',
      range: params.get(`cr-${id}`) === 'yes',
      sex: params.get(`sex-${id}`) ?? '',
    };
  });
  const applyOptions = (next: PanelOptions) => {
    setOptions(next);
    applyOptionParams([
      [`ci-${id}`, next.confidence, 'none'],
      [`pt-${id}`, next.periodType, 'all'],
      [`sex-${id}`, next.sex, ''],
      [`cmp-${id}`, next.benchmark, 'none'],
      [`cr-${id}`, next.range ? 'yes' : '', ''],
    ]);
  };

  const allObservations = areaData[0]?.observations ?? [];
  const sexes = dimensionValues(allObservations, 'Sex');
  // Options offer only what the shown areas publish; England's always-loaded series must not add choices they cannot honour.
  const pickedAreaData = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  const shownObservations = (pickedAreaData.length > 0 ? pickedAreaData : areaData).flatMap(
    ({ observations }) => observations,
  );
  const periodTypes = availablePeriodTypes(shownObservations);
  const confidenceLevels = availableConfidenceLevels(shownObservations);
  // An option in the URL these areas do not publish falls back rather than blanking the table.
  const confidence = confidenceLevels.includes(options.confidence as '95' | '99.8')
    ? options.confidence
    : 'none';
  const periodType = periodTypes.includes(options.periodType as '1-year' | '3-year')
    ? options.periodType
    : 'all';
  const categories = inequalityCategories(allObservations);
  const [category, setCategory] = useState(categories[0] ?? '');
  const periods = inequalityPeriods(allObservations, category, detail.yearType);
  const [period, setPeriod] = useState(periods.at(-1)?.value ?? '');

  const narrow = (data: (typeof areaData)[number]) => ({
    ...data,
    observations: filterObservations(data.observations, {
      // A sex chosen on another indicator's panel must not blank this one's table.
      sex: sexes.includes(options.sex) ? options.sex : '',
      periodType,
    }),
  });
  const filtered = areaData.map(narrow);
  const filteredRegions = regionData.map(narrow);
  // Comparison controls need a real geography picked — England against itself says nothing.
  const hasPickedAreas = pickedAreaData.length > 0;
  const regionAvailable = pickedAreaData.some(({ areaCode }) => geography.regionByCode[areaCode]);
  const panelOptions = (label: string, showConfidence: boolean) => (
    <PanelOptionsPanel
      benchmarks={hasPickedAreas ? { region: regionAvailable } : undefined}
      confidenceLevels={confidenceLevels}
      label={label}
      onChange={applyOptions}
      options={options}
      periodTypes={periodTypes}
      sexes={sexes}
      showConfidence={showConfidence}
    />
  );

  return (
    <section className="fphd-indicator-section" aria-labelledby={`indicator-${id}`}>
      <Heading className="govuk-heading-l" id={`indicator-${id}`}>
        {detail.name}
      </Heading>
      <IndicatorSummary indicator={detail} observations={allObservations} />

      <Tabs
        paramKey={`tab-${id}`}
        title={`${detail.name} data`}
        items={[
          {
            id: `chart-${id}`,
            param: 'chart',
            label: 'Chart',
            content: (
              <ChartSection
                id={`trends-${id}`}
                title="Indicator trends over time"
                description="How this indicator has changed over time."
              />
            ),
          },
          {
            id: `table-${id}`,
            param: 'table',
            label: 'Table',
            content: (
              <>
                <div className="fphd-download-buttons">
                  <Button
                    onClick={() =>
                      downloadCsv(`${detail.fingertipsId}-table.csv`, trendCsv(detail, filtered))
                    }
                    type="button"
                  >
                    Download this table
                  </Button>
                  <Button
                    className="govuk-button--secondary"
                    onClick={() =>
                      downloadCsv(
                        `${detail.fingertipsId}-all-data.csv`,
                        allDataCsv(detail, areaData),
                      )
                    }
                    type="button"
                  >
                    Download all data for this indicator
                  </Button>
                </div>
                {panelOptions('Table options', true)}
                <TrendTable
                  indicator={detail}
                  areaData={filtered}
                  benchmark={hasPickedAreas ? options.benchmark : 'none'}
                  confidence={confidence}
                  geography={geography}
                  ranges={ranges}
                  regionData={filteredRegions}
                  showRange={options.range}
                />
              </>
            ),
          },
          {
            id: `inequalities-${id}`,
            param: 'inequalities',
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
                    confidence={confidence}
                    confidenceLevels={confidenceLevels}
                    onCategoryChange={(value) => {
                      setCategory(value);
                      // The chosen period may not exist for the new category.
                      setPeriod(
                        inequalityPeriods(allObservations, value, detail.yearType).at(-1)?.value ??
                          '',
                      );
                    }}
                    onConfidenceChange={(confidence) => applyOptions({ ...options, confidence })}
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
                    confidence={confidence}
                    observations={inequalityBreakdown(allObservations, category, period)}
                  />
                </>
              ),
          },
          {
            id: `about-${id}`,
            param: 'about',
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
  benchmarkGeography = { regionByCode: {}, levelByCode: {} },
  findResults = [],
  findSubject = '',
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  benchmarkGeography?: BenchmarkGeography;
  findResults?: IndicatorSummaryData[];
  findSubject?: string;
  selection: IndicatorSelection;
}) {
  return (
    <>
      <GridRow>
        <GridColumn width="one-quarter">
          <FilterPane
            key={`${selection.fingertipsIds.join(',')}|${selection.areaType}|${selection.areaCodes.join(',')}|${selection.areaLevels.join(',')}`}
            selected={selected}
            areaGroups={areaGroups}
            findResults={findResults}
            findSubject={findSubject}
            selection={selection}
          />
        </GridColumn>
        <GridColumn width="three-quarters">
          {selected.length === 0 ? (
            <>
              {/* The page's single h1; the prototype's empty state shows only the inset text. */}
              <h1 className="govuk-visually-hidden">Selected indicators</h1>
              <InsetText className="govuk-!-margin-top-0">No indicators selected</InsetText>
            </>
          ) : (
            <>
              {/* One indicator needs no contents list; its own name is the page heading. */}
              {selected.length > 1 ? (
                <nav className="govuk-!-margin-bottom-6">
                  <h1 className="govuk-heading-m">Contents</h1>
                  <ul className="govuk-list">
                    <li>
                      <A href="#compare-indicators">Compare selected indicators</A>
                    </li>
                    {selected.map(({ detail }) => (
                      <li key={detail.fingertipsId}>
                        <A href={`#indicator-${detail.fingertipsId}`}>{detail.name}</A>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}

              {selected.length > 1 ? (
                <ComparisonSection selected={selected} geography={benchmarkGeography} />
              ) : null}

              {selected.map((entry) => (
                <IndicatorBlock
                  key={entry.detail.fingertipsId}
                  {...entry}
                  geography={benchmarkGeography}
                  headingLevel={selected.length === 1 ? 'h1' : 'h2'}
                />
              ))}
            </>
          )}
        </GridColumn>
      </GridRow>
    </>
  );
}

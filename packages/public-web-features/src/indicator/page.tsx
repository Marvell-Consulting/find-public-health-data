import { A, Button, ChartSection, GridColumn, GridRow, InsetText, Tabs } from '@fphd/ui';
import { Form, useLocation } from 'react-router';
import type { GeographyOptions } from '../geography/loader.js';
import { MAX_SELECTED_AREAS, MAX_SELECTED_INDICATORS } from '../selection-limits.js';
import {
  availableConfidenceLevels,
  availablePeriodTypes,
  dimensionValues,
  filterObservations,
  inequalityBreakdown,
  inequalityCategories,
  inequalityPeriods,
} from './data.js';
import { FilterPane } from './filter-pane.js';
import type {
  BenchmarkGeography,
  IndicatorSelection,
  IndicatorSummary as IndicatorSummaryData,
  SelectedArea,
  SelectedIndicator,
} from './loader.js';
import { BackgroundInformation, IndicatorSummary } from './metadata.js';
import {
  InequalityOptions,
  PanelOptionsPanel,
  useOptionParamNavigation,
  usePanelOptions,
} from './options.js';
import { ComparisonSection } from './tables/comparison-section.js';
import { InequalitiesTable } from './tables/inequalities-table.js';
import { TrendTable } from './tables/trend-table.js';

/**
 * Everything shown for one selected indicator, repeated per selection: the summary
 * table, then the Chart / Table / Inequalities / About tab set.
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
  const params = new URLSearchParams(location.search);
  const [options, applyOptions] = usePanelOptions(id);

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
  const requestedCategory = params.get(`ic-${id}`) ?? '';
  const category = categories.includes(requestedCategory)
    ? requestedCategory
    : (categories[0] ?? '');
  const periods = inequalityPeriods(allObservations, category, detail.yearType);
  const requestedPeriod = params.get(`ip-${id}`) ?? '';
  const period = periods.some(({ value }) => value === requestedPeriod)
    ? requestedPeriod
    : (periods.at(-1)?.value ?? '');

  const narrow = (data: (typeof areaData)[number]) => ({
    ...data,
    observations: filterObservations(data.observations, {
      // A sex chosen on another indicator's panel must not blank this one's table.
      sex: sexes.includes(options.sex) ? options.sex : '',
      periodType,
    }),
  });
  const filtered = areaData.map(narrow);
  // The download forms carry the page's state so the server builds the same table.
  const downloadParams = (withOptions: boolean) => {
    const params = new URLSearchParams();
    for (const { areaCode } of pickedAreaData) {
      params.append('as', areaCode);
    }
    if (withOptions) {
      if (sexes.includes(options.sex) && options.sex !== '') {
        params.set(`sex-${id}`, options.sex);
      }
      if (periodType !== 'all') {
        params.set(`pt-${id}`, periodType);
      }
      if (confidence !== 'none') params.set(`ci-${id}`, confidence);
      if (options.benchmark !== 'none') params.set(`cmp-${id}`, options.benchmark);
      if (options.range) params.set(`cr-${id}`, 'yes');
    }
    return [...params];
  };
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
      scope={id}
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
                  <Form action={`/indicators/${id}/table.csv`} method="get" reloadDocument>
                    {downloadParams(true).map(([name, value], index) => (
                      <input key={`${name}-${index}`} name={name} type="hidden" value={value} />
                    ))}
                    <Button type="submit">Download this table</Button>
                  </Form>
                  <Form action={`/indicators/${id}/all-data.csv`} method="get" reloadDocument>
                    {downloadParams(false).map(([name, value], index) => (
                      <input key={`${name}-${index}`} name={name} type="hidden" value={value} />
                    ))}
                    <Button classModifiers="secondary" type="submit">
                      Download all data for this indicator
                    </Button>
                  </Form>
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
                    onCategoryChange={(value) =>
                      applyOptionParams([
                        [`ic-${id}`, value, categories[0] ?? ''],
                        [`ip-${id}`, '', ''],
                      ])
                    }
                    onConfidenceChange={(confidence) => applyOptions({ ...options, confidence })}
                    onPeriodChange={(value) =>
                      applyOptionParams([[`ip-${id}`, value, periods.at(-1)?.value ?? '']])
                    }
                    period={period}
                    periods={periods}
                    scope={id}
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
  selectedAreas = [],
  displayGroups = [],
  benchmarkGeography = { regionByCode: {}, levelByCode: {} },
  findResults = [],
  findSubject = '',
  geographyOptions,
  areasLimited = false,
  indicatorsLimited = false,
  selection,
}: {
  selected: SelectedIndicator[];
  selectedAreas?: SelectedArea[];
  displayGroups?: string[];
  benchmarkGeography?: BenchmarkGeography;
  findResults?: IndicatorSummaryData[];
  findSubject?: string;
  geographyOptions?: GeographyOptions | undefined;
  areasLimited?: boolean;
  indicatorsLimited?: boolean;
  selection: IndicatorSelection;
}) {
  const selectionKey = JSON.stringify(selection);
  return (
    <GridRow>
      <GridColumn width="one-quarter">
        <FilterPane
          key={selectionKey}
          selected={selected}
          selectedAreas={selectedAreas}
          displayGroups={displayGroups}
          findResults={findResults}
          findSubject={findSubject}
          geographyOptions={geographyOptions}
          selection={selection}
        />
      </GridColumn>
      <GridColumn width="three-quarters">
        {indicatorsLimited ? (
          <InsetText>
            Showing the first {MAX_SELECTED_INDICATORS} selected indicators. Select fewer indicators
            to change which ones are shown.
          </InsetText>
        ) : null}
        {areasLimited ? (
          <InsetText>
            Showing the first {MAX_SELECTED_AREAS} selected areas, with England for comparison.
            Select fewer areas to change which ones are shown.
          </InsetText>
        ) : null}
        {selected.length === 0 ? (
          <>
            {/* The page's single h1; visually hidden because the empty state shows only the inset text. */}
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
  );
}

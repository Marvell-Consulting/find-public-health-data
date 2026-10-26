import {
  A,
  Button,
  ChartSection,
  CollapsibleFilterCard,
  FilterChip,
  FilterChips,
  GridColumn,
  GridRow,
  InsetText,
  Select,
  Tabs,
} from '@fphd/ui';
import { Form, Link, useLocation } from 'react-router';
import { DownloadShareData } from '../download-share.tsx';
import type { GeographyOptions } from '../geography/loader.ts';
import { AREA_COMPARISON_GROUPS, areaComparisonRows } from './area-comparison.ts';
import { AreaControls } from './area-controls.tsx';
import { ComparePicker } from './compare-picker.tsx';
import {
  availableConfidenceLevels,
  availablePeriodTypes,
  dimensionValues,
  filterObservations,
  inequalityBreakdown,
  inequalityCategories,
  inequalityCategoryLabel,
  inequalityPeriods,
  trendSeries,
} from './data.ts';
import { IndicatorGeographies } from './geographies.tsx';
import type {
  AreaSummary,
  BenchmarkGeography,
  IndicatorAreaData,
  IndicatorSelection,
  IndicatorSummary as IndicatorSummaryData,
  SelectedArea,
  SelectedIndicator,
} from './loader.ts';
import { BackgroundInformation, IndicatorSummary } from './metadata.tsx';
import {
  InequalityOptions,
  PanelOptionsPanel,
  useOptionParamNavigation,
  usePanelOptions,
} from './options.tsx';
import { indicatorCsvPath } from './paths.ts';
import { AreaComparisonTable } from './tables/area-comparison-table.tsx';
import { IndicatorPairTable } from './tables/indicator-pair-table.tsx';
import { InequalitiesTable } from './tables/inequalities-table.tsx';
import { TrendTable } from './tables/trend-table.tsx';
import { selectedTrendColumns } from './trend.ts';

export function SingleIndicatorPage({
  selected,
  selectedAreas = [],
  compareAreasData = [],
  comparedAreasData = [],
  compareAreaOptions = [],
  compareAreaGroup = 'Local authorities',
  displayGroups = [],
  comparisonDisplayGroups = displayGroups.filter((group) => AREA_COMPARISON_GROUPS.has(group)),
  benchmarkGeography = { regionByCode: {}, levelByCode: {} },
  findResults = [],
  findSubject = '',
  geographyOptions,
  areasLimited = false,
  selection,
}: {
  selected: SelectedIndicator[];
  selectedAreas?: SelectedArea[];
  compareAreasData?: IndicatorAreaData[];
  comparedAreasData?: IndicatorAreaData[];
  compareAreaOptions?: AreaSummary[];
  compareAreaGroup?: string;
  displayGroups?: string[];
  comparisonDisplayGroups?: string[];
  benchmarkGeography?: BenchmarkGeography;
  findResults?: IndicatorSummaryData[];
  findSubject?: string;
  geographyOptions?: GeographyOptions | undefined;
  areasLimited?: boolean;
  selection: IndicatorSelection;
}) {
  const primary = selected[0];
  if (!primary) throw new Error('The indicator page needs one indicator');
  const compared = selected[1];
  const { detail, areaData, regionData = [], ranges = {} } = primary;
  const id = detail.shortId;
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const comparison = areaComparisonRows(primary, compareAreasData, 'descending');
  const comparisonPeriod = comparison.period;
  const comparisonGeography =
    compareAreaGroup === 'Local authorities'
      ? 'county and unitary authority'
      : compareAreaGroup === 'Statistical regions'
        ? 'statistical region'
        : compareAreaGroup === 'NHS regions'
          ? 'NHS region'
          : 'integrated care board';
  const viewDownload = (tab: string) => {
    const viewParams = new URLSearchParams(params);
    viewParams.set('tab-indicator', tab);
    return (
      <DownloadShareData
        inline
        href={`${indicatorCsvPath(detail.slug, 'table')}?${viewParams}`}
        allDataHref={`${indicatorCsvPath(detail.slug, 'all-data')}?allAreas=yes`}
        metadataHref={`/indicator/${detail.slug}/metadata.txt`}
      />
    );
  };
  const [options, applyOptions] = usePanelOptions(id);
  const applyOptionParams = useOptionParamNavigation();
  const allObservations =
    areaData.find(({ areaCode }) => areaCode === 'E92000001')?.observations ??
    areaData[0]?.observations ??
    [];
  const pickedAreaData = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  const shownObservations = (pickedAreaData.length ? pickedAreaData : areaData).flatMap(
    ({ observations }) => observations,
  );
  const sexes = dimensionValues(allObservations, 'Sex');
  const periodTypes = availablePeriodTypes(shownObservations);
  const confidenceLevels = availableConfidenceLevels(shownObservations);
  const columns = selectedTrendColumns(params, id, confidenceLevels);
  const confidence = confidenceLevels.includes(options.confidence as '95' | '99.8')
    ? options.confidence
    : 'none';
  const periodType = periodTypes.includes(options.periodType as '1-year' | '3-year')
    ? options.periodType
    : 'all';
  const areasWithInequalities = areaData.filter(
    ({ observations }) => inequalityCategories(observations).length > 0,
  );
  const inequalityAreas = areasWithInequalities.length ? areasWithInequalities : areaData;
  const inequalityArea =
    inequalityAreas.find(({ areaCode }) => areaCode === params.get(`ig-${id}`)) ??
    inequalityAreas.find(({ areaCode }) => areaCode === 'E92000001') ??
    inequalityAreas[0];
  const inequalityObservations = inequalityArea?.observations ?? [];
  const categories = inequalityCategories(inequalityObservations);
  const requestedCategory = params.get(`ic-${id}`) ?? '';
  const category = categories.includes(requestedCategory)
    ? requestedCategory
    : (categories[0] ?? '');
  const periods = inequalityPeriods(inequalityObservations, category, detail.yearType);
  const requestedPeriod = params.get(`ip-${id}`) ?? '';
  const period = periods.some(({ value }) => value === requestedPeriod)
    ? requestedPeriod
    : (periods.at(-1)?.value ?? '');
  const inequalityRows = inequalityBreakdown(inequalityObservations, category, period);
  const inequalityBenchmarkObservation = trendSeries(allObservations).find(
    (row) =>
      row.fromDate === inequalityRows[0]?.fromDate && row.toDate === inequalityRows[0]?.toDate,
  );
  const inequalityBenchmark = inequalityBenchmarkObservation?.value ?? null;
  const inequalityConfidence = params.has(`ci-${id}`)
    ? confidence
    : confidenceLevels.includes('99.8')
      ? '99.8'
      : confidenceLevels.includes('95')
        ? '95'
        : 'none';
  const narrow = (data: (typeof areaData)[number]) => ({
    ...data,
    observations: filterObservations(data.observations, {
      sex: sexes.includes(options.sex) ? options.sex : '',
      periodType,
    }),
  });
  const filtered = areaData.map(narrow);
  const filteredRegions = regionData.map(narrow);
  const hasPickedAreas = pickedAreaData.length > 0;
  const regionAvailable = pickedAreaData.some(
    ({ areaCode }) => benchmarkGeography.regionByCode[areaCode],
  );
  const geography = (
    <IndicatorGeographies
      displayGroups={displayGroups}
      geographyOptions={geographyOptions}
      slug={detail.slug}
      selection={selection}
    />
  );
  const downloadParams = (withOptions: boolean) => {
    const next = new URLSearchParams();
    for (const { areaCode } of pickedAreaData) next.append('as', areaCode);
    if (withOptions) {
      next.set('order', 'desc');
      next.set(
        `columns-${id}`,
        [columns.count ? 'count' : '', columns.value ? 'value' : '', ...columns.confidence]
          .filter(Boolean)
          .join(',') || 'none',
      );
      if (sexes.includes(options.sex) && options.sex) next.set(`sex-${id}`, options.sex);
      if (periodType !== 'all') next.set(`pt-${id}`, periodType);
      if (confidence !== 'none') next.set(`ci-${id}`, confidence);
      if (options.benchmark !== 'none') next.set(`cmp-${id}`, options.benchmark);
      if (options.range) next.set(`cr-${id}`, 'yes');
    }
    return [...next];
  };
  const selectionUrl = (areaCodes: string[], areaLevels: string[]) => {
    const next = new URLSearchParams(params);
    next.delete('as');
    next.delete('als');
    for (const code of areaCodes) next.append('as', code);
    for (const level of areaLevels) next.append('als', level);
    return `${location.pathname}?${next}`;
  };
  const showing = (
    <div className="fphd-indicator-showing">
      <p className="govuk-body-s govuk-!-margin-bottom-1">Showing:</p>
      <FilterChips>
        <FilterChip value="E92000001">England</FilterChip>
        {selection.areaLevels.map((level) => (
          <FilterChip
            key={level}
            value={level}
            removeLabel={level}
            onRemove={selectionUrl(
              selection.areaCodes,
              selection.areaLevels.filter((entry) => entry !== level),
            )}
          >
            {level}
          </FilterChip>
        ))}
        {selection.areaCodes.map((code) => {
          const name = selectedAreas.find((area) => area.code === code)?.name ?? code;
          return (
            <FilterChip
              key={code}
              value={code}
              removeLabel={name}
              onRemove={selectionUrl(
                selection.areaCodes.filter((entry) => entry !== code),
                selection.areaLevels,
              )}
            >
              {name}
            </FilterChip>
          );
        })}
      </FilterChips>
    </div>
  );
  const download = (
    <DownloadShareData
      inline
      href={`${indicatorCsvPath(detail.slug, 'table')}?${new URLSearchParams(downloadParams(true))}`}
      allDataHref={`${indicatorCsvPath(detail.slug, 'all-data')}?allAreas=yes`}
      metadataHref={`/indicator/${detail.slug}/metadata.txt`}
    />
  );

  return (
    <div className="fphd-wide-layout fphd-single-indicator-page">
      <nav aria-label="Breadcrumb" className="govuk-breadcrumbs">
        <ol className="govuk-breadcrumbs__list">
          <li className="govuk-breadcrumbs__list-item">
            <Link className="govuk-breadcrumbs__link" to="/">
              Home
            </Link>
          </li>
          <li className="govuk-breadcrumbs__list-item">
            <Link className="govuk-breadcrumbs__link" to="/topics">
              Topics
            </Link>
          </li>
          {detail.topics[0] ? (
            <li className="govuk-breadcrumbs__list-item">
              <Link className="govuk-breadcrumbs__link" to={`/topics/${detail.topics[0].slug}`}>
                {detail.topics[0].title}
              </Link>
            </li>
          ) : null}
        </ol>
      </nav>
      <h1 className="govuk-heading-l govuk-!-margin-bottom-3">{detail.name}</h1>
      <IndicatorSummary indicator={detail} observations={allObservations} />
      {areasLimited ? (
        <InsetText>
          Showing the first 20 selected areas. Select fewer areas to change which ones are shown.
        </InsetText>
      ) : null}
      <Tabs
        defaultParam={compared ? 'compare' : undefined}
        paramKey="tab-indicator"
        title={`${detail.name} contents`}
        items={[
          {
            id: 'indicator-data',
            param: 'indicator',
            label: 'Indicator',
            content: (
              <>
                <h2 className="govuk-heading-l">Indicator</h2>
                <a className="govuk-link govuk-visually-hidden-focusable" href="#indicator-table">
                  Skip to indicator chart and table
                </a>
                <GridRow>
                  <GridColumn width="one-quarter">
                    {geography}
                    <h2 className="govuk-heading-m">Display options</h2>
                    <PanelOptionsPanel
                      accordion
                      columns={columns}
                      onColumnsChange={(next) =>
                        applyOptionParams([
                          [
                            `columns-${id}`,
                            [
                              next.count ? 'count' : '',
                              next.value ? 'value' : '',
                              ...next.confidence,
                            ]
                              .filter(Boolean)
                              .join(',') || 'none',
                            'default',
                          ],
                        ])
                      }
                      benchmarks={hasPickedAreas ? { region: regionAvailable } : undefined}
                      confidenceLevels={confidenceLevels}
                      label="Table columns"
                      onChange={applyOptions}
                      options={options}
                      periodTypes={periodTypes}
                      scope={id}
                      sexes={sexes}
                      showConfidence
                    />
                  </GridColumn>
                  <GridColumn width="three-quarters">
                    {showing}
                    {download}
                    <div className="fphd-indicator-chart fphd-indicator-chart--trend">
                      <h3 className="govuk-heading-s">Chart: {detail.name}</h3>
                      <ChartSection
                        id="indicator-trend-chart"
                        title={`${detail.name} trend chart`}
                        description="How this indicator has changed over time for the selected geographies."
                      />
                    </div>
                    <div id="indicator-table" className="govuk-!-margin-top-4">
                      <TrendTable
                        newestFirst
                        columns={columns}
                        visibleCaption
                        indicator={detail}
                        areaData={filtered}
                        benchmark={hasPickedAreas ? options.benchmark : 'none'}
                        confidence={confidence}
                        geography={benchmarkGeography}
                        ranges={ranges}
                        regionData={filteredRegions}
                        showRange={options.range}
                      />
                    </div>
                    {detail.dataSource ? (
                      <p className="govuk-body-s">
                        Source:{' '}
                        {detail.dataSource.url ? (
                          <A href={detail.dataSource.url}>{detail.dataSource.name}</A>
                        ) : (
                          detail.dataSource.name
                        )}
                      </p>
                    ) : null}
                  </GridColumn>
                </GridRow>
              </>
            ),
          },
          {
            id: 'indicator-compare-areas',
            param: 'areas',
            label: 'Compare areas',
            content: (
              <>
                <h2 className="govuk-heading-l">Compare areas</h2>
                <p className="govuk-body">
                  {detail.name} for every {comparisonGeography} in England, most recent{' '}
                  {comparison.multiYear ? 'multi-year' : 'single-year'} data
                  {comparisonPeriod ? ` (${comparisonPeriod})` : ''}.
                </p>
                <GridRow>
                  <GridColumn width="one-quarter">
                    <AreaControls
                      slug={detail.slug}
                      group={compareAreaGroup}
                      groups={comparisonDisplayGroups}
                      areas={compareAreaOptions}
                    />
                  </GridColumn>
                  <GridColumn width="three-quarters">
                    <div className="fphd-indicator-showing">
                      <p className="govuk-body-s govuk-!-margin-bottom-1">Showing:</p>
                      <FilterChips>
                        <FilterChip value={compareAreaGroup}>{compareAreaGroup}</FilterChip>
                      </FilterChips>
                    </div>
                    {viewDownload('areas')}
                    <GridRow className="fphd-area-table-layout">
                      <GridColumn width="one-half" className="fphd-area-table">
                        <AreaComparisonTable
                          indicator={primary}
                          areaData={compareAreasData}
                          sort={params.get('areaSort') ?? 'descending'}
                          highlighted={params.getAll('highlight')}
                          colour={params.get('areaColour') ?? 'england'}
                        />
                      </GridColumn>
                      <GridColumn width="one-half" className="fphd-map-space">
                        <h3 className="govuk-heading-s govuk-!-margin-bottom-2">Map view</h3>
                        <p className="govuk-body-s">
                          Map of {detail.name} by {compareAreaGroup.toLowerCase()} in England.
                        </p>
                        <div className="fphd-indicator-chart fphd-indicator-chart--map">
                          <ChartSection
                            id="indicator-area-map"
                            title={`${detail.name} map`}
                            description="Map visualisation"
                          />
                        </div>
                      </GridColumn>
                    </GridRow>
                  </GridColumn>
                </GridRow>
              </>
            ),
          },
          {
            id: 'indicator-compare-indicators',
            param: 'compare',
            label: 'Compare indicators',
            content: (
              <>
                <h2 className="govuk-heading-l">Compare indicators</h2>
                <GridRow>
                  {compared ? (
                    <GridColumn width="one-quarter">
                      <AreaControls
                        slug={detail.slug}
                        group={compareAreaGroup}
                        groups={comparisonDisplayGroups}
                        areas={compareAreaOptions}
                        displayOptions={false}
                      />
                    </GridColumn>
                  ) : null}
                  <GridColumn width={compared ? 'three-quarters' : 'two-thirds'}>
                    <ComparePicker
                      slug={detail.slug}
                      key={compared?.detail.slug ?? 'unselected'}
                      name={detail.name}
                      compared={compared?.detail}
                      findSubject={findSubject}
                      findResults={findResults.filter(({ shortId }) => shortId !== id)}
                    />
                    {compared ? (
                      <>
                        <div className="fphd-indicator-showing">
                          <p className="govuk-body-s govuk-!-margin-bottom-1">Showing:</p>
                          <FilterChips>
                            <FilterChip value="E92000001">England</FilterChip>
                          </FilterChips>
                        </div>
                        {viewDownload('compare')}
                        <div className="fphd-indicator-chart fphd-indicator-chart--scatter">
                          <h3 className="govuk-heading-s">Chart of indicator comparison</h3>
                          <ChartSection
                            id="indicator-comparison-chart"
                            title="Indicator comparison scatter chart"
                            description={`${detail.name} compared with ${compared.detail.name} for the selected geographies.`}
                          />
                        </div>
                        <IndicatorPairTable
                          selected={[
                            {
                              ...primary,
                              areaData: [
                                ...primary.areaData.filter(
                                  ({ areaCode }) => areaCode === 'E92000001',
                                ),
                                ...compareAreasData,
                              ],
                            },
                            {
                              ...compared,
                              areaData: [
                                ...compared.areaData.filter(
                                  ({ areaCode }) => areaCode === 'E92000001',
                                ),
                                ...comparedAreasData,
                              ],
                            },
                          ]}
                          group={compareAreaGroup}
                          highlighted={params.getAll('highlight')}
                        />
                      </>
                    ) : null}
                  </GridColumn>
                </GridRow>
              </>
            ),
          },
          {
            id: 'indicator-inequalities',
            param: 'inequalities',
            label: 'Inequalities',
            content: (
              <>
                <h2 className="govuk-heading-l">Inequalities</h2>
                <GridRow>
                  <GridColumn width="one-quarter">
                    <h2 className="govuk-heading-m">Geographies</h2>
                    <CollapsibleFilterCard
                      active
                      variant="accordion"
                      headingLevel={3}
                      title="Geographies"
                    >
                      <Form method="get" action={location.pathname}>
                        {[...params]
                          .filter(([name]) => name !== `ig-${id}`)
                          .map(([name, value], index) => (
                            <input
                              key={`${name}-${index}`}
                              type="hidden"
                              name={name}
                              value={value}
                            />
                          ))}
                        <Select
                          id={`inequality-area-${id}`}
                          name={`ig-${id}`}
                          label="Geography"
                          value={inequalityArea?.areaCode ?? 'E92000001'}
                          options={inequalityAreas.map(({ areaCode, areaName }) => ({
                            value: areaCode,
                            label: areaName,
                          }))}
                          onChange={(event) =>
                            applyOptionParams([
                              [`ig-${id}`, event.currentTarget.value, 'E92000001'],
                            ])
                          }
                        />
                        <noscript>
                          <Button type="submit">Apply geography</Button>
                        </noscript>
                      </Form>
                    </CollapsibleFilterCard>
                    {categories.length > 0 ? (
                      <>
                        <h2 className="govuk-heading-m">Display options</h2>
                        <InequalityOptions
                          accordion
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
                          onConfidenceChange={(confidence) =>
                            applyOptions({ ...options, confidence })
                          }
                          onPeriodChange={(value) =>
                            applyOptionParams([[`ip-${id}`, value, periods.at(-1)?.value ?? '']])
                          }
                          period={period}
                          periods={periods}
                          scope={id}
                        />
                      </>
                    ) : null}
                  </GridColumn>
                  <GridColumn width="three-quarters">
                    <div className="fphd-indicator-showing">
                      <p className="govuk-body-s govuk-!-margin-bottom-1">Showing:</p>
                      <FilterChips>
                        <FilterChip value={inequalityArea?.areaCode ?? 'E92000001'}>
                          {inequalityArea?.areaName ?? 'England'}
                        </FilterChip>
                      </FilterChips>
                    </div>
                    {categories.length === 0 ? (
                      <p className="govuk-body">
                        This indicator has no inequality breakdowns for the selected areas.
                      </p>
                    ) : (
                      <>
                        {viewDownload('inequalities')}
                        <div className="fphd-indicator-chart fphd-indicator-chart--inequalities">
                          <h3 className="govuk-heading-s">Chart of inequalities: {detail.name}</h3>
                          <ChartSection
                            id="indicator-inequalities-chart"
                            title={`${detail.name} inequalities chart`}
                            description={`${inequalityCategoryLabel(category, true)}, ${inequalityArea?.areaName ?? 'England'}, ${periods.find(({ value }) => value === period)?.label ?? ''}.`}
                          />
                        </div>
                        <InequalitiesTable
                          benchmark={inequalityBenchmark}
                          benchmarkCount={inequalityBenchmarkObservation?.count ?? null}
                          indicator={detail}
                          confidence={inequalityConfidence}
                          observations={inequalityRows}
                          areaName={inequalityArea?.areaName ?? 'England'}
                        />
                        {detail.dataSource || detail.numeratorSources.length ? (
                          <p className="govuk-body-s">
                            Source:{' '}
                            {detail.numeratorSources.length
                              ? detail.numeratorSources
                                  .map(({ provider, source }) =>
                                    source ? `${provider}: ${source}` : provider,
                                  )
                                  .join('; ')
                              : detail.dataSource?.name}
                          </p>
                        ) : null}
                      </>
                    )}
                  </GridColumn>
                </GridRow>
              </>
            ),
          },
          {
            id: 'indicator-about',
            param: 'about',
            label: 'About this indicator',
            content: (
              <>
                <h2 className="govuk-heading-l">About this indicator</h2>
                <BackgroundInformation indicator={detail} observations={allObservations} />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

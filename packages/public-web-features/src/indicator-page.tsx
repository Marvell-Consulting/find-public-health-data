import {
  A,
  BackLink,
  Button,
  ChartSection,
  GridColumn,
  GridRow,
  InsetText,
  PageIntro,
  Tabs,
} from '@fphd/ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

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
}: SelectedIndicator & { geography: BenchmarkGeography }) {
  const id = detail.fingertipsId;
  const location = useLocation();
  const navigate = useNavigate();
  // The option choices live in the query string (`ci`, `pt`, `sex`, `cmp`, `cr`), so they
  // survive the full page reload every filter change causes. Reading them from the
  // location keeps server and client renders identical.
  const params = new URLSearchParams(location.search);
  const [options, setOptions] = useState<PanelOptions>(() => {
    const ci = params.get('ci');
    const pt = params.get('pt');
    const cmp = params.get('cmp');
    return {
      benchmark: cmp === 'england' || cmp === 'region' ? (cmp as BenchmarkChoice) : 'none',
      confidence: ci === '95' || ci === '99.8' ? ci : 'none',
      periodType: pt === '1-year' || pt === '3-year' ? pt : 'all',
      range: params.get('cr') === 'yes',
      sex: params.get('sex') ?? '',
    };
  });
  const applyOptions = (next: PanelOptions) => {
    setOptions(next);
    const nextParams = new URLSearchParams(location.search);
    for (const [key, value, empty] of [
      ['ci', next.confidence, 'none'],
      ['pt', next.periodType, 'all'],
      ['sex', next.sex, ''],
      ['cmp', next.benchmark, 'none'],
      ['cr', next.range ? 'yes' : '', ''],
    ] as const) {
      if (value === empty) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }
    // Through the router — not history.replaceState — so the filter pane's links see the
    // change; the route's shouldRevalidate stops the loader refetching over it.
    void navigate(
      { search: `?${nextParams.toString()}`, hash: location.hash.slice(1) },
      { replace: true, preventScrollReset: true },
    );
  };

  const allObservations = areaData[0]?.observations ?? [];
  const sexes = dimensionValues(allObservations, 'Sex');
  const periodTypes = availablePeriodTypes(areaData.flatMap(({ observations }) => observations));
  const confidenceLevels = availableConfidenceLevels(
    areaData.flatMap(({ observations }) => observations),
  );
  // A level in the URL that this indicator does not publish falls back to none.
  const confidence = confidenceLevels.includes(options.confidence as '95' | '99.8')
    ? options.confidence
    : 'none';
  const categories = inequalityCategories(allObservations);
  const [category, setCategory] = useState(categories[0] ?? '');
  const periods = inequalityPeriods(allObservations, category, detail.yearType);
  const [period, setPeriod] = useState(periods.at(-1)?.value ?? '');

  const narrow = (data: (typeof areaData)[number]) => ({
    ...data,
    observations: filterObservations(data.observations, {
      // A sex chosen on another indicator's panel must not blank this one's table.
      sex: sexes.includes(options.sex) ? options.sex : '',
      periodType: options.periodType,
    }),
  });
  const filtered = areaData.map(narrow);
  const filteredRegions = regionData.map(narrow);
  // The comparison controls only make sense once a real geography is picked — England
  // against itself says nothing.
  const hasPickedAreas = areaData.some(({ areaCode }) => areaCode !== 'E92000001');
  const regionAvailable = areaData.some(({ areaCode }) => geography.regionByCode[areaCode]);
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
              <ChartSection
                id={`trends-${id}`}
                title="Indicator trends over time"
                description="How this indicator has changed over time."
              />
            ),
          },
          {
            id: `table-${id}`,
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
  benchmarkGeography = { regionByCode: {}, levelByCode: {} },
  searchResults = [],
  searchSubject = '',
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  availableIndicators: IndicatorSummaryData[];
  benchmarkGeography?: BenchmarkGeography;
  searchResults?: IndicatorSummaryData[];
  searchSubject?: string;
  selection: IndicatorSelection;
}) {
  return (
    <>
      <BackLink href="/" />
      <GridRow>
        <GridColumn width="one-quarter">
          <FilterPane
            key={`${selection.fingertipsIds.join(',')}|${selection.areaType}|${selection.areaCodes.join(',')}|${selection.areaLevels.join(',')}`}
            selected={selected}
            areaGroups={areaGroups}
            availableIndicators={availableIndicators}
            selection={selection}
          />
        </GridColumn>
        <GridColumn width="three-quarters">
          {selected.length === 0 ? (
            searchSubject ? (
              <>
                <PageIntro size="l" title={`Search results for “${searchSubject}”`} />
                {searchResults.length === 0 ? (
                  <p className="govuk-body">
                    No indicators match your search. Try a different term, or add an indicator from
                    the filters.
                  </p>
                ) : (
                  <>
                    <p className="govuk-body">
                      {searchResults.length} indicator{searchResults.length === 1 ? '' : 's'} found.
                    </p>
                    <ul className="govuk-list">
                      {searchResults.map(({ fingertipsId, name }) => (
                        <li key={fingertipsId}>
                          <A href={`/indicators/${fingertipsId}`}>{name}</A>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <InsetText className="govuk-!-margin-top-0">No indicators selected</InsetText>
            )
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

              {selected.length > 1 ? (
                <ComparisonSection selected={selected} geography={benchmarkGeography} />
              ) : null}

              {selected.map((entry) => (
                <IndicatorBlock
                  key={entry.detail.fingertipsId}
                  {...entry}
                  geography={benchmarkGeography}
                />
              ))}
            </>
          )}
        </GridColumn>
      </GridRow>
    </>
  );
}

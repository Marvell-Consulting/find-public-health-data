import { A, Button, ChartSection, GridColumn, GridRow, InsetText, Tabs } from '@fphd/ui';
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
  // The option choices live in the query string, suffixed with the indicator's id
  // (`ci-241`, `cmp-241`…) so each table's options are its own, yet a shared or
  // reloaded URL reproduces the exact view. Reading them from the location keeps
  // server and client renders identical.
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
    const nextParams = new URLSearchParams(location.search);
    for (const [key, value, empty] of [
      [`ci-${id}`, next.confidence, 'none'],
      [`pt-${id}`, next.periodType, 'all'],
      [`sex-${id}`, next.sex, ''],
      [`cmp-${id}`, next.benchmark, 'none'],
      [`cr-${id}`, next.range ? 'yes' : '', ''],
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
      { search: `?${nextParams.toString()}` },
      { replace: true, preventScrollReset: true },
    );
  };

  const allObservations = areaData[0]?.observations ?? [];
  const sexes = dimensionValues(allObservations, 'Sex');
  // The options offer only what the SHOWN areas publish — England always rides along
  // for the benchmark, and its yearly series must not put a "1 year" choice on a page
  // whose picked areas are rolling-only (the table would have nothing to show).
  const pickedAreaData = areaData.filter(({ areaCode }) => areaCode !== 'E92000001');
  const shownObservations = (pickedAreaData.length > 0 ? pickedAreaData : areaData).flatMap(
    ({ observations }) => observations,
  );
  const periodTypes = availablePeriodTypes(shownObservations);
  const confidenceLevels = availableConfidenceLevels(shownObservations);
  // A level or period shape in the URL that these areas do not publish falls back to
  // the default rather than blanking the table.
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
        paramKey={`tab-${id}`}
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
  benchmarkGeography = { regionByCode: {}, levelByCode: {} },
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  benchmarkGeography?: BenchmarkGeography;
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
            selection={selection}
          />
        </GridColumn>
        <GridColumn width="three-quarters">
          {selected.length === 0 ? (
            <InsetText className="govuk-!-margin-top-0">No indicators selected</InsetText>
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

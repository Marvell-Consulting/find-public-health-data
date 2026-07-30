import {
  A,
  BackLink,
  ChartSection,
  decodeEntities,
  GridColumn,
  GridRow,
  PageIntro,
  SectionBreak,
} from '@fphd/ui';
import { type ReactNode, useId } from 'react';
import { Form, useNavigate } from 'react-router';

import {
  formatConfidenceInterval,
  formatValue,
  latestCoreSegments,
  periodLabel,
  segmentLabel,
  trendSeries,
} from './indicator-data';
import type {
  AreaSummary,
  IndicatorAreaData,
  IndicatorDetail,
  IndicatorObservation,
  IndicatorSelection,
} from './indicator-loader';

const CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  '95': '95%',
  '99.8': '99.8%',
  both: '95% and 99.8%',
};

function FilterPane({
  indicator,
  availableAreas,
  selection,
}: {
  indicator: IndicatorDetail;
  availableAreas: AreaSummary[];
  selection: IndicatorSelection;
}) {
  const areaTypeId = useId();
  const groupTypeId = useId();
  const groupId = useId();
  const checkboxIdPrefix = useId();
  const navigate = useNavigate();

  return (
    <div className="fphd-filter-pane">
      <div className="fphd-filter-pane__header">
        <h2 className="govuk-heading-m">Filters</h2>
        <button type="button" className="govuk-link fphd-link-button">
          Hide filter
        </button>
      </div>
      <div className="fphd-filter-pane__body">
        <p className="govuk-body govuk-!-font-weight-bold">Selected indicators (1)</p>
        <div className="fphd-filter-pane__selected-card">
          <p className="govuk-body govuk-!-margin-bottom-1">{indicator.name}</p>
          <A href="#background">View background information</A>
        </div>
        <a href="/" role="button" draggable="false" className="govuk-button">
          Add or change indicators
        </a>

        <div className="fphd-filter-pane__row">
          <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">
            Selected areas ({selection.areaCodes.length})
          </p>
          <a className="govuk-link" href="?">
            Clear all
          </a>
        </div>
        {selection.areaCodes.length === 0 ? (
          <p className="govuk-body">Default area England</p>
        ) : null}

        <Form method="get">
          <div className="govuk-form-group">
            <label className="govuk-label govuk-!-font-weight-bold" htmlFor={areaTypeId}>
              Select a type of health or administrative area
            </label>
            <select
              className="govuk-select"
              id={areaTypeId}
              name="ats"
              defaultValue={selection.areaType}
              onChange={(event) => {
                // Changing type invalidates the current area selection, so navigate with
                // the new type alone; without JavaScript the Apply button does the same.
                navigate(
                  { search: `?ats=${encodeURIComponent(event.currentTarget.value)}` },
                  { preventScrollReset: true },
                );
              }}
            >
              {indicator.areaTypes.map((areaType) => (
                <option key={areaType.name}>{areaType.name}</option>
              ))}
            </select>
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label govuk-!-font-weight-bold" htmlFor={groupTypeId}>
              Select a type of group to compare with
            </label>
            <select className="govuk-select" id={groupTypeId} defaultValue="England">
              <option>England</option>
            </select>
          </div>

          <div className="govuk-form-group">
            <label className="govuk-label govuk-!-font-weight-bold" htmlFor={groupId}>
              Select a group
            </label>
            <select className="govuk-select" id={groupId} defaultValue="England">
              <option>England</option>
            </select>
          </div>

          <fieldset className="govuk-fieldset">
            <legend className="govuk-fieldset__legend govuk-!-font-weight-bold">
              Select one or more areas
            </legend>
            <div className="fphd-filter-pane__areas govuk-checkboxes govuk-checkboxes--small">
              {availableAreas.map((area) => {
                const checkboxId = `${checkboxIdPrefix}-${area.code}`;
                return (
                  <div className="govuk-checkboxes__item" key={area.code}>
                    <input
                      className="govuk-checkboxes__input"
                      id={checkboxId}
                      type="checkbox"
                      name="as"
                      value={area.code}
                      defaultChecked={selection.areaCodes.includes(area.code)}
                    />
                    <label className="govuk-label govuk-checkboxes__label" htmlFor={checkboxId}>
                      {area.name}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <button type="submit" className="govuk-button govuk-!-margin-top-4">
            Apply filters
          </button>
        </Form>
      </div>
    </div>
  );
}

function DefinitionBlock({ title, text }: { title: string; text: string | null }) {
  if (!text) {
    return null;
  }

  return (
    <>
      <h4 className="govuk-heading-s">{title}</h4>
      <p className="govuk-body fphd-metadata-text">{decodeEntities(text)}</p>
    </>
  );
}

function TableRow({ label, value }: { label: string; value: ReactNode | null }) {
  if (!value) {
    return null;
  }

  return (
    <tr className="govuk-table__row">
      <th scope="row" className="govuk-table__header">
        {label}
      </th>
      <td className="govuk-table__cell">{value}</td>
    </tr>
  );
}

function sourceLink(source: IndicatorDetail['dataSource']) {
  if (!source) {
    return null;
  }

  return source.url ? <A href={source.url}>{source.name}</A> : source.name;
}

const updatedFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The at-a-glance header the prototype puts above each indicator's charts. Collections are
 * shown as tags: they come from Fingertips profiles today, so the label stays generic
 * rather than promising the editorial topic list this is expected to become.
 */
function IndicatorSummary({ indicator }: { indicator: IndicatorDetail }) {
  return (
    <table className="govuk-table">
      <tbody className="govuk-table__body">
        <TableRow
          label="Last updated"
          value={
            indicator.dataUpdatedAt ? updatedFormat.format(new Date(indicator.dataUpdatedAt)) : null
          }
        />
        <TableRow
          label="Collections"
          value={
            indicator.collections.length > 0 ? (
              <ul className="govuk-list fphd-tag-list">
                {indicator.collections.map((collectionItem) => (
                  <li className="fphd-tag" key={collectionItem.slug}>
                    {collectionItem.name}
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
        <TableRow
          label="Definition"
          value={indicator.definition ? decodeEntities(indicator.definition) : null}
        />
      </tbody>
    </table>
  );
}

function BackgroundInformation({ indicator }: { indicator: IndicatorDetail }) {
  const confidenceLevel = indicator.ciConfidenceLevel
    ? (CONFIDENCE_LEVEL_LABELS[indicator.ciConfidenceLevel] ?? indicator.ciConfidenceLevel)
    : null;

  return (
    <section id="background">
      <h2 className="govuk-heading-l">Background information and indicator definitions</h2>
      <p className="govuk-body-s govuk-!-margin-bottom-0">Indicator ID {indicator.fingertipsId}</p>
      <p className="govuk-body-s">Frequency {indicator.frequency}</p>

      <SectionBreak size="m" visible />

      <p className="govuk-body">Contents</p>
      <ul className="govuk-list fphd-contents-list">
        <li>
          <A href="#definitions">Indicator definitions</A>
        </li>
        <li>
          <A href="#sources">Data sources and reuse</A>
        </li>
        <li>
          <A href="#benchmarking">Benchmarking and confidence information</A>
        </li>
        <li>
          <A href="#rationale">Indicator rationale</A>
        </li>
        <li>
          <A href="#notes">Notes and caveats</A>
        </li>
      </ul>

      <h3 className="govuk-heading-m" id="definitions">
        Indicator definitions
      </h3>
      <DefinitionBlock title="Definition" text={indicator.definition} />
      <DefinitionBlock title="Methodology" text={indicator.methodology} />
      <DefinitionBlock title="Definition of numerator" text={indicator.numeratorDefinition} />
      <DefinitionBlock title="Definition of denominator" text={indicator.denominatorDefinition} />
      <DefinitionBlock title="Disclosure control" text={indicator.disclosureControl} />
      <table className="govuk-table">
        <tbody className="govuk-table__body">
          <TableRow label="Value type" value={indicator.valueType} />
          <TableRow label="Unit" value={indicator.unit.name} />
          <TableRow label="Year type" value={indicator.yearType} />
          <TableRow label="Polarity" value={indicator.polarity} />
        </tbody>
      </table>

      <h3 className="govuk-heading-m" id="sources">
        Data sources and reuse
      </h3>
      <table className="govuk-table">
        <tbody className="govuk-table__body">
          <TableRow label="Data source" value={sourceLink(indicator.dataSource)} />
          <TableRow label="Source of numerator" value={sourceLink(indicator.numeratorSource)} />
          <TableRow label="Source of denominator" value={sourceLink(indicator.denominatorSource)} />
        </tbody>
      </table>

      <h3 className="govuk-heading-m" id="benchmarking">
        Benchmarking and confidence information
      </h3>
      <table className="govuk-table">
        <tbody className="govuk-table__body">
          <TableRow label="Benchmarking method" value={indicator.comparatorMethod} />
          <TableRow label="Confidence interval method" value={indicator.ciMethod} />
          <TableRow label="Confidence level" value={confidenceLevel} />
        </tbody>
      </table>

      {indicator.rationale ? (
        <>
          <h3 className="govuk-heading-m" id="rationale">
            Indicator rationale
          </h3>
          <p className="govuk-body fphd-metadata-text">{decodeEntities(indicator.rationale)}</p>
        </>
      ) : null}

      {indicator.notes || indicator.caveats ? (
        <>
          <h3 className="govuk-heading-m" id="notes">
            Notes and caveats
          </h3>
          <DefinitionBlock title="Notes" text={indicator.notes} />
          <DefinitionBlock title="Caveats" text={indicator.caveats} />
        </>
      ) : null}
    </section>
  );
}

function SegmentationTable({
  indicator,
  data,
}: {
  indicator: IndicatorDetail;
  data: IndicatorAreaData;
}) {
  const segments = latestCoreSegments(data.observations);
  const first = segments[0];
  if (!first) {
    return null;
  }

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {data.areaName}, {periodLabel(first)}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          <th scope="col" className="govuk-table__header">
            Segment
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            95% confidence interval
          </th>
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {segments.map((observation) => (
          <tr className="govuk-table__row" key={segmentLabel(observation)}>
            <th scope="row" className="govuk-table__header">
              {segmentLabel(observation)}
            </th>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatValue(observation.value)}
            </td>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatConfidenceInterval(observation)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrendTable({
  indicator,
  areaData,
}: {
  indicator: IndicatorDetail;
  areaData: IndicatorAreaData[];
}) {
  const seriesByArea = areaData
    .map((data) => ({ data, series: trendSeries(data.observations) }))
    .filter(({ series }) => series.length > 0);
  const firstObservation = seriesByArea[0]?.series[0];
  if (!firstObservation) {
    return null;
  }
  const multipleAreas = seriesByArea.length > 1;

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {multipleAreas ? (
          segmentLabel(firstObservation)
        ) : (
          <>
            {seriesByArea[0]?.data.areaName}, {segmentLabel(firstObservation)}
          </>
        )}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          {multipleAreas ? (
            <th scope="col" className="govuk-table__header">
              Area
            </th>
          ) : null}
          <th scope="col" className="govuk-table__header">
            Period
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            95% confidence interval
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Count
          </th>
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {seriesByArea.flatMap(({ data, series }) =>
          series.map((observation) => (
            <tr
              className="govuk-table__row"
              key={`${data.areaCode}-${observation.fromDate}-${observation.toDate}`}
            >
              {multipleAreas ? (
                <th scope="row" className="govuk-table__header">
                  {data.areaName}
                </th>
              ) : null}
              <th scope="row" className="govuk-table__header">
                {periodLabel(observation)}
              </th>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {formatValue(observation.value)}
              </td>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {formatConfidenceInterval(observation)}
              </td>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {observation.count === null ? '—' : formatValue(observation.count)}
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

function CompareAreasTable({
  indicator,
  areaData,
}: {
  indicator: IndicatorDetail;
  areaData: IndicatorAreaData[];
}) {
  const latestByArea = areaData
    .map((data) => ({ data, latest: trendSeries(data.observations).at(-1) }))
    .filter((entry): entry is { data: IndicatorAreaData; latest: IndicatorObservation } =>
      Boolean(entry.latest),
    );
  const first = latestByArea[0];
  if (!first) {
    return null;
  }

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {periodLabel(first.latest)}, {segmentLabel(first.latest)}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          <th scope="col" className="govuk-table__header">
            Area
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            95% confidence interval
          </th>
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {latestByArea.map(({ data, latest }) => (
          <tr className="govuk-table__row" key={data.areaCode}>
            <th scope="row" className="govuk-table__header">
              {data.areaName}
            </th>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatValue(latest.value)}
            </td>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatConfidenceInterval(latest)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function IndicatorPage({
  indicator,
  availableAreas,
  areaData,
  selection,
}: {
  indicator: IndicatorDetail;
  availableAreas: AreaSummary[];
  areaData: IndicatorAreaData[];
  selection: IndicatorSelection;
}) {
  const benchmarkId = useId();

  return (
    <>
      <BackLink href="/" />
      <GridRow>
        <GridColumn width="one-quarter">
          <FilterPane
            key={`${selection.areaType}|${selection.areaCodes.join(',')}`}
            indicator={indicator}
            availableAreas={availableAreas}
            selection={selection}
          />
        </GridColumn>
        <GridColumn width="three-quarters">
          <PageIntro size="l" title={indicator.name} />
          <IndicatorSummary indicator={indicator} />

          <p className="govuk-body govuk-!-margin-bottom-1">Available charts</p>
          <ul className="govuk-list govuk-list--bullet">
            <li>
              <A href="#segmentations">Indicator segmentations overview</A>
            </li>
            <li>
              <A href="#trends">Indicator trends over time</A>
            </li>
            <li>
              <A href="#compare-areas">Compare areas for one time period</A>
            </li>
          </ul>

          <div className="govuk-form-group">
            <label className="govuk-label govuk-!-font-weight-bold" htmlFor={benchmarkId}>
              Select a benchmark for all charts
            </label>
            <select className="govuk-select" id={benchmarkId} defaultValue="England">
              <option>England</option>
            </select>
          </div>

          <ChartSection
            id="segmentations"
            title="Indicator segmentations overview"
            description="An overview of this indicator's values across its reported segments, compared with the benchmark."
          >
            {areaData[0] ? <SegmentationTable indicator={indicator} data={areaData[0]} /> : null}
          </ChartSection>
          <ChartSection
            id="trends"
            title="Indicator trends over time"
            description="How this indicator has changed over time."
          >
            <TrendTable indicator={indicator} areaData={areaData} />
          </ChartSection>
          <ChartSection
            id="compare-areas"
            title="Compare areas for one time period"
            description="How areas compare with each other for the latest time period."
          >
            <CompareAreasTable indicator={indicator} areaData={areaData} />
          </ChartSection>

          <div className="fphd-chart-section">
            <h3 className="govuk-heading-m">Related population data</h3>
            <details className="govuk-details">
              <summary className="govuk-details__summary">
                <span className="govuk-details__summary-text">Show population data</span>
              </summary>
              <div className="govuk-details__text">
                <p className="govuk-body">
                  Population breakdown for the selected areas.{' '}
                  <span className="govuk-hint">Data visualisation to follow</span>
                </p>
              </div>
            </details>
          </div>

          <SectionBreak size="l" visible />
          <BackgroundInformation indicator={indicator} />
        </GridColumn>
      </GridRow>
    </>
  );
}

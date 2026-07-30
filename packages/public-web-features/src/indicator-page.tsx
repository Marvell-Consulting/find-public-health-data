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
  comparisonRows,
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
  IndicatorSummary,
  SelectedIndicator,
} from './indicator-loader';

const CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  '95': '95%',
  '99.8': '99.8%',
  both: '95% and 99.8%',
};

/** The query string for a selection, so every control links to a complete page state. */
function selectionSearch({
  selection,
  fingertipsIds = selection.fingertipsIds,
}: {
  selection: IndicatorSelection;
  fingertipsIds?: number[];
}) {
  const params = new URLSearchParams();
  for (const id of fingertipsIds) {
    params.append('is', String(id));
  }
  if (selection.areaType) {
    params.set('ats', selection.areaType);
  }
  for (const code of selection.areaCodes) {
    params.append('as', code);
  }
  return `?${params.toString()}`;
}

function FilterPane({
  selected,
  availableAreas,
  availableIndicators,
  selection,
}: {
  selected: SelectedIndicator[];
  availableAreas: AreaSummary[];
  availableIndicators: IndicatorSummary[];
  selection: IndicatorSelection;
}) {
  const areaTypeId = useId();
  const groupTypeId = useId();
  const groupId = useId();
  const checkboxIdPrefix = useId();
  const addIndicatorId = useId();
  const navigate = useNavigate();

  const unselected = availableIndicators.filter(
    ({ fingertipsId }) => !selection.fingertipsIds.includes(fingertipsId),
  );

  // Area types every selected indicator publishes against, so a choice cannot produce a
  // page where some indicators have no data at all. England is always offered.
  const areaTypeOptions =
    selected.length === 0
      ? ['England']
      : selected
          .map(({ detail }) => detail.areaTypes.map(({ name }) => name))
          .reduce((shared, names) => shared.filter((name) => names.includes(name)));

  return (
    <div className="fphd-filter-pane">
      <div className="fphd-filter-pane__header">
        <h2 className="govuk-heading-m">Filters</h2>
        <button type="button" className="govuk-link fphd-link-button">
          Hide filter
        </button>
      </div>
      <div className="fphd-filter-pane__body">
        <div className="fphd-filter-pane__row">
          <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">
            Selected indicators ({selected.length})
          </p>
          {selected.length > 0 ? (
            <A className="govuk-link" href={selectionSearch({ selection, fingertipsIds: [] })}>
              Clear all
            </A>
          ) : null}
        </div>
        {selected.length === 0 ? <p className="govuk-body">None selected</p> : null}
        {selected.map(({ detail }) => (
          <div className="fphd-filter-pane__selected-card" key={detail.fingertipsId}>
            <p className="govuk-body govuk-!-margin-bottom-1">{detail.name}</p>
            <A href={`#background-${detail.fingertipsId}`}>View background information</A>{' '}
            <A
              href={selectionSearch({
                selection,
                fingertipsIds: selection.fingertipsIds.filter((id) => id !== detail.fingertipsId),
              })}
            >
              Remove
            </A>
          </div>
        ))}

        {unselected.length > 0 ? (
          <div className="govuk-form-group">
            <label className="govuk-label govuk-!-font-weight-bold" htmlFor={addIndicatorId}>
              Add an indicator
            </label>
            <select
              className="govuk-select"
              id={addIndicatorId}
              defaultValue=""
              onChange={(event) => {
                const added = Number(event.currentTarget.value);
                if (added) {
                  navigate({
                    search: selectionSearch({
                      selection,
                      fingertipsIds: [...selection.fingertipsIds, added],
                    }),
                  });
                }
              }}
            >
              <option value="">Choose an indicator</option>
              {unselected.map((option) => (
                <option key={option.fingertipsId} value={option.fingertipsId}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="fphd-filter-pane__row">
          <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-1">
            Selected areas ({selection.areaCodes.length})
          </p>
          <A
            className="govuk-link"
            href={selectionSearch({ selection: { ...selection, areaCodes: [] } })}
          >
            Clear all
          </A>
        </div>
        {selection.areaCodes.length === 0 ? (
          <p className="govuk-body">Default area England</p>
        ) : null}

        <Form method="get">
          {/* The selected indicators ride along so applying an area filter keeps them. */}
          {selection.fingertipsIds.map((id) => (
            <input key={id} type="hidden" name="is" value={id} />
          ))}
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
                  {
                    search: selectionSearch({
                      selection: {
                        ...selection,
                        areaType: event.currentTarget.value,
                        areaCodes: [],
                      },
                    }),
                  },
                  { preventScrollReset: true },
                );
              }}
            >
              {areaTypeOptions.map((name) => (
                <option key={name}>{name}</option>
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

/** The at-a-glance header the prototype puts above each indicator's charts. */
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
          label="Topics"
          value={
            indicator.topics.length > 0 ? (
              <ul className="govuk-list fphd-tag-list">
                {indicator.topics.map((topicItem) => (
                  <li className="fphd-tag" key={topicItem.slug}>
                    <A href={`/topics/${topicItem.slug}`}>{topicItem.title}</A>
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
    <section id={`background-${indicator.fingertipsId}`}>
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

/** Everything shown for one selected indicator, repeated per selection. */
function IndicatorBlock({ detail, areaData }: SelectedIndicator) {
  const id = detail.fingertipsId;

  return (
    <section aria-labelledby={`indicator-${id}`}>
      <h2 className="govuk-heading-l" id={`indicator-${id}`}>
        {detail.name}
      </h2>
      <IndicatorSummary indicator={detail} />

      <p className="govuk-body govuk-!-margin-bottom-1">Available charts</p>
      <ul className="govuk-list govuk-list--bullet">
        <li>
          <A href={`#segmentations-${id}`}>Indicator segmentations overview</A>
        </li>
        <li>
          <A href={`#trends-${id}`}>Indicator trends over time</A>
        </li>
        <li>
          <A href={`#compare-areas-${id}`}>Compare areas for one time period</A>
        </li>
      </ul>

      <ChartSection
        id={`segmentations-${id}`}
        title="Indicator segmentations overview"
        description="An overview of this indicator's values across its reported segments, compared with the benchmark."
      >
        {areaData[0] ? <SegmentationTable indicator={detail} data={areaData[0]} /> : null}
      </ChartSection>
      <ChartSection
        id={`trends-${id}`}
        title="Indicator trends over time"
        description="How this indicator has changed over time."
      >
        <TrendTable indicator={detail} areaData={areaData} />
      </ChartSection>
      <ChartSection
        id={`compare-areas-${id}`}
        title="Compare areas for one time period"
        description="How areas compare with each other for the latest time period."
      >
        <CompareAreasTable indicator={detail} areaData={areaData} />
      </ChartSection>

      <BackgroundInformation indicator={detail} />
      <SectionBreak size="l" visible />
    </section>
  );
}

/** Only shown for two or more indicators: their latest values side by side. */
function ComparisonSection({ selected }: { selected: SelectedIndicator[] }) {
  const rows = comparisonRows(selected);
  const areaName = rows.find((row) => row.areaName)?.areaName;

  return (
    <div className="fphd-chart-section" id="compare-indicators">
      <h2 className="govuk-heading-l">Compare selected indicators</h2>
      <table className="govuk-table">
        {areaName ? (
          <caption className="govuk-table__caption govuk-table__caption--s">{areaName}</caption>
        ) : null}
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th scope="col" className="govuk-table__header">
              Indicator
            </th>
            <th scope="col" className="govuk-table__header">
              Most recent period
            </th>
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              Count
            </th>
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {rows.map((row) => (
            <tr className="govuk-table__row" key={row.fingertipsId}>
              <th scope="row" className="govuk-table__header">
                <A href={`#indicator-${row.fingertipsId}`}>{row.name}</A>
                {row.segment ? <span className="govuk-hint"> {row.segment}</span> : null}
              </th>
              <td className="govuk-table__cell">{row.period || 'No data'}</td>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {row.count === null ? '—' : formatValue(row.count)}
              </td>
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {row.value === null ? 'No data' : `${formatValue(row.value)} ${row.unit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IndicatorPage({
  selected,
  availableAreas,
  availableIndicators,
  selection,
}: {
  selected: SelectedIndicator[];
  availableAreas: AreaSummary[];
  availableIndicators: IndicatorSummary[];
  selection: IndicatorSelection;
}) {
  const benchmarkId = useId();

  return (
    <>
      <BackLink href="/" />
      <GridRow>
        <GridColumn width="one-quarter">
          <FilterPane
            key={`${selection.fingertipsIds.join(',')}|${selection.areaType}|${selection.areaCodes.join(',')}`}
            selected={selected}
            availableAreas={availableAreas}
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
              <PageIntro size="l" title="View data for selected indicators and areas" />

              {selected.length > 1 ? (
                <>
                  <p className="govuk-body govuk-!-margin-bottom-1">Contents</p>
                  <ul className="govuk-list fphd-contents-list">
                    <li>
                      <A href="#compare-indicators">Compare selected indicators</A>
                    </li>
                    {selected.map(({ detail }) => (
                      <li key={detail.fingertipsId}>
                        <A href={`#indicator-${detail.fingertipsId}`}>{detail.name}</A>
                      </li>
                    ))}
                  </ul>
                  <ComparisonSection selected={selected} />
                </>
              ) : null}

              <div className="govuk-form-group">
                <label className="govuk-label govuk-!-font-weight-bold" htmlFor={benchmarkId}>
                  Select a benchmark for all charts
                </label>
                <select className="govuk-select" id={benchmarkId} defaultValue="England">
                  <option>England</option>
                </select>
              </div>

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

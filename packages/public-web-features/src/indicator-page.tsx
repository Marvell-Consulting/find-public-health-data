import {
  A,
  Autocomplete,
  BackLink,
  ChartSection,
  decodeEntities,
  FilterCard,
  FilterChip,
  FilterChips,
  GeographyTree,
  GridColumn,
  GridRow,
  PageIntro,
  SectionBreak,
  Tabs,
} from '@fphd/ui';
import { type ReactNode, useId, useState } from 'react';
import { Form, useNavigate } from 'react-router';

import {
  barWidth,
  type ConfidenceLevel,
  comparisonRows,
  confidenceInterval,
  dimensionValues,
  filterObservations,
  formatValue,
  inequalityBreakdown,
  inequalityCategories,
  inequalityPeriods,
  latestCoreSegments,
  type PeriodType,
  periodLabel,
  periodTypeLabel,
  segmentLabel,
  trendSeries,
} from './indicator-data';
import type {
  AreaGroup,
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
  areaGroups,
  availableIndicators,
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  availableIndicators: IndicatorSummary[];
  selection: IndicatorSelection;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string[]>([]);

  const unselected = availableIndicators.filter(
    ({ fingertipsId }) => !selection.fingertipsIds.includes(fingertipsId),
  );
  const areaName = (code: string) =>
    areaGroups.flatMap(({ areas }) => areas).find((area) => area.code === code)?.name ?? code;

  return (
    <>
      <FilterCard
        title="Selected indicators"
        onClear={
          selected.length > 0 ? selectionSearch({ selection, fingertipsIds: [] }) : undefined
        }
        body={
          selected.length === 0 ? (
            <p className="govuk-body">None selected</p>
          ) : (
            <FilterChips>
              {selected.map(({ detail }) => (
                <FilterChip
                  key={detail.fingertipsId}
                  onRemove={selectionSearch({
                    selection,
                    fingertipsIds: selection.fingertipsIds.filter(
                      (id) => id !== detail.fingertipsId,
                    ),
                  })}
                  removeLabel={detail.name}
                  value={String(detail.fingertipsId)}
                >
                  {detail.name}
                </FilterChip>
              ))}
            </FilterChips>
          )
        }
        footer={
          unselected.length > 0 ? (
            <Autocomplete
              label="Search for an indicator"
              options={unselected.map(({ fingertipsId, name }) => ({
                value: String(fingertipsId),
                label: name,
              }))}
              onSelect={({ value }) =>
                navigate({
                  search: selectionSearch({
                    selection,
                    fingertipsIds: [...selection.fingertipsIds, Number(value)],
                  }),
                })
              }
            />
          ) : null
        }
      />

      <FilterCard
        title="Geography filters"
        onClear={
          selection.areaCodes.length > 0
            ? selectionSearch({ selection: { ...selection, areaCodes: [] } })
            : undefined
        }
        body={
          <>
            <p className="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-2">
              Selected areas
            </p>
            <FilterChips>
              {/* England is the default comparison, so it has no remove control. */}
              <FilterChip value="E92000001">England</FilterChip>
              {selection.areaCodes
                .filter((code) => code !== 'E92000001')
                .map((code) => (
                  <FilterChip
                    key={code}
                    onRemove={selectionSearch({
                      selection: {
                        ...selection,
                        areaCodes: selection.areaCodes.filter((value) => value !== code),
                      },
                    })}
                    removeLabel={areaName(code)}
                    value={code}
                  >
                    {areaName(code)}
                  </FilterChip>
                ))}
            </FilterChips>
          </>
        }
        footer={
          <Form method="get">
            {/* The selected indicators ride along so applying an area filter keeps them. */}
            {selection.fingertipsIds.map((id) => (
              <input key={id} type="hidden" name="is" value={id} />
            ))}
            <GeographyTree
              groups={areaGroups.map(({ areaType, areas }) => ({ name: areaType, areas }))}
              name="as"
              onChange={setPending}
              selected={pending}
            />
            {/* Ticking gathers a pending set; adding them is the deliberate second step, so
                a long list can be built up without the page reloading between each tick. */}
            {pending.length > 0 ? (
              <button
                className="govuk-button govuk-!-margin-top-3 govuk-!-margin-bottom-0"
                onClick={(event) => {
                  event.preventDefault();
                  setPending([]);
                  navigate({
                    search: selectionSearch({
                      selection: {
                        ...selection,
                        areaCodes: [...new Set([...selection.areaCodes, ...pending])],
                      },
                    }),
                  });
                }}
                type="submit"
              >
                Add selected geographies ({pending.length})
              </button>
            ) : null}
          </Form>
        }
      />
    </>
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
  confidence,
  data,
  indicator,
}: {
  confidence: ConfidenceLevel;
  data: IndicatorAreaData;
  indicator: IndicatorDetail;
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
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
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
            {confidence === 'none' ? null : (
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {confidenceInterval(observation, confidence)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrendTable({
  areaData,
  confidence,
  indicator,
}: {
  areaData: IndicatorAreaData[];
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
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
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
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
              {confidence === 'none' ? null : (
                <td className="govuk-table__cell govuk-table__cell--numeric">
                  {confidenceInterval(observation, confidence)}
                </td>
              )}
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
  areaData,
  benchmark,
  confidence,
  indicator,
}: {
  areaData: IndicatorAreaData[];
  benchmark: string;
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
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
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
          {benchmark ? (
            <th scope="col" className="govuk-table__header">
              Compared with {benchmark}
            </th>
          ) : null}
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
            {confidence === 'none' ? null : (
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {confidenceInterval(latest, confidence)}
              </td>
            )}
            {benchmark ? (
              <td className="govuk-table__cell">
                {/* Significance against the benchmark is a calculation the service does
                    not perform yet, so the column states what it will compare, not a
                    verdict it cannot support. */}
                <span className="govuk-hint">Comparison to follow</span>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface PanelOptions {
  benchmark: string;
  confidence: ConfidenceLevel;
  periodType: PeriodType;
  sex: string;
}

/**
 * The prototype's "Chart options" / "Table options" disclosure. Every panel offers the
 * benchmark and confidence-interval choices; the sex and period controls appear only
 * where the indicator reports those segments.
 */
function PanelOptionsPanel({
  benchmarks,
  label,
  onChange,
  options,
  sexes,
  showConfidence,
}: {
  benchmarks: string[];
  label: string;
  onChange: (options: PanelOptions) => void;
  options: PanelOptions;
  sexes: string[];
  showConfidence: boolean;
}) {
  const ids = {
    benchmark: useId(),
    confidence: useId(),
    period: useId(),
    sex: useId(),
  };

  return (
    <details className="govuk-details fphd-segmentation-options" open>
      <summary className="govuk-details__summary">
        <span className="govuk-details__summary-text">{label}</span>
      </summary>
      <div className="govuk-details__text fphd-segmentation-options__selects">
        {sexes.length > 0 ? (
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label govuk-label--s" htmlFor={ids.sex}>
              Select sex
            </label>
            <select
              className="govuk-select"
              id={ids.sex}
              onChange={(event) => onChange({ ...options, sex: event.currentTarget.value })}
              value={options.sex}
            >
              <option value="">All</option>
              {sexes.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="govuk-form-group govuk-!-margin-bottom-0">
          <label className="govuk-label govuk-label--s" htmlFor={ids.period}>
            Select time period type
          </label>
          <select
            className="govuk-select"
            id={ids.period}
            onChange={(event) =>
              onChange({ ...options, periodType: event.currentTarget.value as PeriodType })
            }
            value={options.periodType}
          >
            {(['all', '1-year', '3-year'] as const).map((value) => (
              <option key={value} value={value}>
                {periodTypeLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {showConfidence ? (
          <div className="govuk-form-group govuk-!-margin-bottom-0">
            <label className="govuk-label govuk-label--s" htmlFor={ids.confidence}>
              Select confidence intervals
            </label>
            <select
              className="govuk-select"
              id={ids.confidence}
              onChange={(event) =>
                onChange({ ...options, confidence: event.currentTarget.value as ConfidenceLevel })
              }
              value={options.confidence}
            >
              <option value="none">None</option>
              <option value="95">95%</option>
              <option value="99.8">99.8%</option>
            </select>
          </div>
        ) : null}

        <div className="govuk-form-group govuk-!-margin-bottom-0">
          <label className="govuk-label govuk-label--s" htmlFor={ids.benchmark}>
            Select a geography or goal to compare with
          </label>
          <select
            className="govuk-select"
            id={ids.benchmark}
            onChange={(event) => onChange({ ...options, benchmark: event.currentTarget.value })}
            value={options.benchmark}
          >
            <option value="">None</option>
            {benchmarks.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
    </details>
  );
}

/** The prototype's Inequalities "Options" disclosure: category, period and intervals. */
function InequalityOptions({
  categories,
  category,
  confidence,
  onCategoryChange,
  onConfidenceChange,
  onPeriodChange,
  period,
  periods,
}: {
  categories: string[];
  category: string;
  confidence: ConfidenceLevel;
  onCategoryChange: (value: string) => void;
  onConfidenceChange: (value: ConfidenceLevel) => void;
  onPeriodChange: (value: string) => void;
  period: string;
  periods: { value: string; label: string }[];
}) {
  const categoryId = useId();
  const periodId = useId();
  const confidenceId = useId();

  return (
    <details className="govuk-details fphd-segmentation-options" open>
      <summary className="govuk-details__summary">
        <span className="govuk-details__summary-text">Options</span>
      </summary>
      <div className="govuk-details__text fphd-segmentation-options__selects">
        <div className="govuk-form-group govuk-!-margin-bottom-0">
          <label className="govuk-label govuk-label--s" htmlFor={categoryId}>
            Select inequality category
          </label>
          <select
            className="govuk-select"
            id={categoryId}
            onChange={(event) => onCategoryChange(event.currentTarget.value)}
            value={category}
          >
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="govuk-form-group govuk-!-margin-bottom-0">
          <label className="govuk-label govuk-label--s" htmlFor={periodId}>
            Select time period
          </label>
          <select
            className="govuk-select"
            id={periodId}
            onChange={(event) => onPeriodChange(event.currentTarget.value)}
            value={period}
          >
            {periods.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="govuk-form-group govuk-!-margin-bottom-0">
          <label className="govuk-label govuk-label--s" htmlFor={confidenceId}>
            Select confidence intervals
          </label>
          <select
            className="govuk-select"
            id={confidenceId}
            onChange={(event) => onConfidenceChange(event.currentTarget.value as ConfidenceLevel)}
            value={confidence}
          >
            <option value="none">None</option>
            <option value="95">95%</option>
            <option value="99.8">99.8%</option>
          </select>
        </div>
      </div>
    </details>
  );
}

function InequalitiesTable({
  confidence,
  indicator,
  observations,
}: {
  confidence: ConfidenceLevel;
  indicator: IndicatorDetail;
  observations: IndicatorObservation[];
}) {
  const first = observations[0];
  if (!first) {
    return null;
  }
  const dimensionType =
    first.dimensions.find(({ dimensionClass }) => dimensionClass === 'inequality')?.type ?? '';

  return (
    <table className="govuk-table">
      <caption className="govuk-table__caption govuk-table__caption--s">
        {dimensionType}, {periodLabel(first)}
      </caption>
      <thead className="govuk-table__head">
        <tr className="govuk-table__row">
          <th scope="col" className="govuk-table__header">
            Segment
          </th>
          <th scope="col" className="govuk-table__header govuk-table__header--numeric">
            Value ({indicator.unit.name})
          </th>
          {confidence === 'none' ? null : (
            <th scope="col" className="govuk-table__header govuk-table__header--numeric">
              {confidence}% confidence interval
            </th>
          )}
        </tr>
      </thead>
      <tbody className="govuk-table__body">
        {observations.map((observation) => (
          <tr className="govuk-table__row" key={segmentLabel(observation)}>
            <th scope="row" className="govuk-table__header">
              {segmentLabel(observation)}
            </th>
            <td className="govuk-table__cell govuk-table__cell--numeric">
              {formatValue(observation.value)}
            </td>
            {confidence === 'none' ? null : (
              <td className="govuk-table__cell govuk-table__cell--numeric">
                {confidenceInterval(observation, confidence)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
      <IndicatorSummary indicator={detail} />

      <Tabs
        label={`${detail.name} data`}
        tabs={[
          {
            id: `chart-${id}`,
            label: 'Chart',
            panel: (
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
            panel: (
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
            panel:
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
            panel: <BackgroundInformation indicator={detail} />,
          },
        ]}
      />
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
              <td className="govuk-table__cell">
                {row.value === null ? (
                  'No data'
                ) : (
                  <span className="fphd-bar-container">
                    <span
                      aria-hidden="true"
                      className="fphd-bar"
                      // Indicators use different units, so each bar is scaled against the
                      // largest value sharing its unit — never across unrelated scales.
                      style={{ width: `${barWidth(row, rows)}%` }}
                    />
                    <span>
                      {formatValue(row.value)} {row.unit}
                    </span>
                  </span>
                )}
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
  areaGroups,
  availableIndicators,
  selection,
}: {
  selected: SelectedIndicator[];
  areaGroups: AreaGroup[];
  availableIndicators: IndicatorSummary[];
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

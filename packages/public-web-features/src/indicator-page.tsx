import { A, GridColumn, GridRow, SectionBreak } from '@fphd/ui';
import { type ReactNode, useId } from 'react';

import type { IndicatorDetail } from './indicator-loader';

const CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  '95': '95%',
  '99.8': '99.8%',
  both: '95% and 99.8%',
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  pound: '£',
  quot: '"',
};

// Pholio metadata arrives with HTML entities baked into the plain text (`&hellip;`,
// `&nbsp;`), which React would otherwise render literally.
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.toLowerCase().startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Stands in for a chart that is not built yet (ADR013): a labelled, keyboard-reachable
 * region rather than a blank div, so the page's accessibility structure is real from the
 * start and each chart ticket replaces a placeholder in situ.
 */
function ChartSection({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const headingId = useId();

  return (
    <div className="fphd-chart-section" id={id}>
      <h3 className="govuk-heading-m" id={headingId}>
        {title}
      </h3>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: ADR013 requires chart regions to be keyboard-reachable from day one, the focusable scrollable-region pattern real charts will need. */}
      <section className="fphd-chart-placeholder" aria-labelledby={headingId} tabIndex={0}>
        <p className="govuk-body">{description}</p>
        <p className="govuk-hint">Data visualisation to follow</p>
      </section>
    </div>
  );
}

function FilterPane({ indicator }: { indicator: IndicatorDetail }) {
  const areaTypeId = useId();
  const groupTypeId = useId();
  const groupId = useId();
  const selectAllCheckboxId = useId();
  const englandCheckboxId = useId();

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
            Selected areas (0)
          </p>
          <button type="button" className="govuk-link fphd-link-button">
            Clear all
          </button>
        </div>
        <p className="govuk-body">Default area England</p>

        <div className="govuk-form-group">
          <label className="govuk-label govuk-!-font-weight-bold" htmlFor={areaTypeId}>
            Select a type of health or administrative area
          </label>
          <select className="govuk-select" id={areaTypeId} defaultValue="England">
            <option>England</option>
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
          <div className="fphd-filter-pane__row">
            <div className="govuk-checkboxes govuk-checkboxes--small">
              <div className="govuk-checkboxes__item">
                <input
                  className="govuk-checkboxes__input"
                  id={selectAllCheckboxId}
                  type="checkbox"
                />
                <label
                  className="govuk-label govuk-checkboxes__label"
                  htmlFor={selectAllCheckboxId}
                >
                  Select all areas
                </label>
              </div>
            </div>
            <button type="button" className="govuk-link fphd-link-button">
              Clear all
            </button>
          </div>
          <SectionBreak size="m" visible />
          <div className="govuk-checkboxes govuk-checkboxes--small">
            <div className="govuk-checkboxes__item">
              <input className="govuk-checkboxes__input" id={englandCheckboxId} type="checkbox" />
              <label className="govuk-label govuk-checkboxes__label" htmlFor={englandCheckboxId}>
                England
              </label>
            </div>
          </div>
        </fieldset>
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

export function IndicatorPage({ indicator }: { indicator: IndicatorDetail }) {
  const benchmarkId = useId();

  return (
    <>
      <A href="/" className="govuk-back-link">
        Back
      </A>
      <GridRow>
        <GridColumn width="one-quarter">
          <FilterPane indicator={indicator} />
        </GridColumn>
        <GridColumn width="three-quarters">
          <h1 className="govuk-heading-l">View data for selected indicators and areas</h1>

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
          />
          <ChartSection
            id="trends"
            title="Indicator trends over time"
            description="How this indicator has changed over time."
          />
          <ChartSection
            id="compare-areas"
            title="Compare areas for one time period"
            description="How areas compare with each other for the latest time period."
          />

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

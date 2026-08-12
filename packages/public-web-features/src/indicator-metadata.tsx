import { A, decodeEntities, SectionBreak } from '@fphd/ui';
import type { ReactNode } from 'react';

import { periodCovered } from './indicator-data';
import type { IndicatorDetail, IndicatorObservation } from './indicator-loader';

const CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  '95': '95%',
  '99.8': '99.8%',
  both: '95% and 99.8%',
};

export function DefinitionBlock({ title, text }: { title: string; text: string | null }) {
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

export function TableRow({ label, value }: { label: string; value: ReactNode | null }) {
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

export function sourceLink(source: IndicatorDetail['dataSource']) {
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
export function IndicatorSummary({
  indicator,
  observations,
}: {
  indicator: IndicatorDetail;
  observations: IndicatorObservation[];
}) {
  const ofDimension = (dimension: string) =>
    indicator.classifications.filter((entry) => entry.dimension === dimension);

  return (
    <table className="govuk-table">
      <tbody className="govuk-table__body">
        <TableRow label="Period covered" value={periodCovered(observations)} />
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
          label="Indicator types"
          value={
            ofDimension('indicator_type').length > 0 ? (
              <ul className="govuk-list fphd-tag-list">
                {ofDimension('indicator_type').map((entry) => (
                  <li className="fphd-tag" key={entry.slug}>
                    {entry.name}
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

export function BackgroundInformation({ indicator }: { indicator: IndicatorDetail }) {
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

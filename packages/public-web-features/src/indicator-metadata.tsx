import { A, plainTextFromHtml, SectionBreak, SummaryList } from '@fphd/ui';
import type { ReactNode } from 'react';

import { periodCovered, recentTrend } from './indicator-data';
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
      <p className="govuk-body fphd-metadata-text">{plainTextFromHtml(text)}</p>
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
  const trend = recentTrend(observations, indicator.polarity);

  return (
    <table className="govuk-table">
      <tbody className="govuk-table__body">
        <TableRow label="Period covered" value={periodCovered(observations, indicator.yearType)} />
        <TableRow
          label="Last updated"
          value={
            indicator.dataUpdatedAt ? updatedFormat.format(new Date(indicator.dataUpdatedAt)) : null
          }
        />
        <TableRow
          label="Most recent trend"
          value={
            <strong className={`govuk-tag govuk-tag--${trend.tone} fphd-trend-tag`}>
              {trend.direction ? (
                <span
                  className={`fphd-trend-tag__arrow fphd-trend-tag__arrow--${trend.direction}`}
                  aria-hidden="true"
                />
              ) : null}
              <span className="fphd-trend-tag__text">{trend.label}</span>
            </strong>
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
          label="Risk factors"
          value={
            ofDimension('risk_factor').length > 0 ? (
              <ul className="govuk-list fphd-tag-list">
                {ofDimension('risk_factor').map((entry) => (
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
          value={indicator.definition ? plainTextFromHtml(indicator.definition) : null}
        />
      </tbody>
    </table>
  );
}

function CalculationPart({
  title,
  explainer,
  source,
  definition,
}: {
  title: string;
  explainer: string;
  source: IndicatorDetail['dataSource'];
  definition: string | null;
}) {
  if (!source && !definition) {
    return null;
  }

  return (
    <>
      <h3 className="govuk-heading-s">{title}</h3>
      <p className="govuk-body">{explainer}</p>
      <SummaryList
        items={[
          ...(source ? [{ name: 'Sources', children: sourceLink(source) }] : []),
          ...(definition
            ? [
                {
                  name: 'Definition',
                  children: (
                    <span className="fphd-metadata-text">{plainTextFromHtml(definition)}</span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

/** The prototype's About tab: Overview, Data attributes, Calculation, Other notes. */
export function BackgroundInformation({ indicator }: { indicator: IndicatorDetail }) {
  const confidenceLevel = indicator.ciConfidenceLevel
    ? (CONFIDENCE_LEVEL_LABELS[indicator.ciConfidenceLevel] ?? indicator.ciConfidenceLevel)
    : null;
  const attribute = (name: string, value: string | null) =>
    value ? [{ name, children: value }] : [];

  return (
    <section id={`background-${indicator.fingertipsId}`}>
      <h2 className="govuk-heading-l">Overview</h2>
      <SummaryList
        items={[
          { name: 'Indicator ID', children: String(indicator.fingertipsId) },
          ...(indicator.rationale
            ? [
                {
                  name: 'Rationale',
                  children: (
                    <span className="fphd-metadata-text">
                      {plainTextFromHtml(indicator.rationale)}
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      <SectionBreak size="m" visible />

      <h2 className="govuk-heading-l">Data attributes</h2>
      <SummaryList
        items={[
          ...attribute('Value type', indicator.valueType),
          ...attribute('Unit', indicator.unit.name),
          ...attribute('Year type', indicator.yearType),
          ...attribute('Frequency', indicator.frequency),
          ...attribute('Polarity', indicator.polarity),
          ...(indicator.dataSource
            ? [{ name: 'Data source', children: sourceLink(indicator.dataSource) }]
            : []),
        ]}
      />

      <SectionBreak size="m" visible />

      <h2 className="govuk-heading-l">Calculation</h2>
      <CalculationPart
        title="Numerator"
        explainer="This is the count, or raw number, of the thing an indicator measures."
        source={indicator.numeratorSource}
        definition={indicator.numeratorDefinition}
      />
      <CalculationPart
        title="Denominator"
        explainer="This is the total eligible group an indicator covers."
        source={indicator.denominatorSource}
        definition={indicator.denominatorDefinition}
      />
      {indicator.methodology ? (
        <>
          <h3 className="govuk-heading-s">Method</h3>
          <p className="govuk-body fphd-metadata-text">
            {plainTextFromHtml(indicator.methodology)}
          </p>
        </>
      ) : null}
      {indicator.ciMethod || confidenceLevel || indicator.comparatorMethod ? (
        <>
          <h3 className="govuk-heading-s">Confidence intervals</h3>
          <SummaryList
            items={[
              ...attribute('Confidence interval method', indicator.ciMethod),
              ...attribute('Confidence level', confidenceLevel),
              ...attribute('Benchmarking method', indicator.comparatorMethod),
            ]}
          />
        </>
      ) : null}

      {indicator.disclosureControl || indicator.notes || indicator.caveats ? (
        <>
          <SectionBreak size="m" visible />
          <h2 className="govuk-heading-l">Other notes and caveats</h2>
          <DefinitionBlock title="Disclosure control" text={indicator.disclosureControl} />
          <DefinitionBlock title="Notes" text={indicator.notes} />
          <DefinitionBlock title="Caveats" text={indicator.caveats} />
        </>
      ) : null}
    </section>
  );
}

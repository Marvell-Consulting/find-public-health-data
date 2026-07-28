import { A, PageIntro } from '@fphd/ui';
import { useId } from 'react';

import type { IndicatorDetail } from './indicator-loader';

const CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  '95': '95%',
  '99.8': '99.8%',
  both: '95% and 99.8%',
};

/**
 * Stands in for a chart that is not built yet (ADR013): a labelled, keyboard-reachable
 * region rather than a blank div, so the page's accessibility structure is real from the
 * start and each chart ticket replaces a placeholder in situ.
 */
function ChartPlaceholder({ title, description }: { title: string; description: string }) {
  const headingId = useId();

  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: ADR013 requires chart regions to be keyboard-reachable from day one, the focusable scrollable-region pattern real charts will need.
    <section className="fphd-chart-placeholder" aria-labelledby={headingId} tabIndex={0}>
      <h3 className="govuk-heading-s" id={headingId}>
        {title}
      </h3>
      <p className="govuk-body">{description}</p>
      <p className="govuk-hint">Data visualisation to follow</p>
    </section>
  );
}

function MetadataSection({ title, text }: { title: string; text: string | null }) {
  if (!text) {
    return null;
  }

  return (
    <>
      <h3 className="govuk-heading-s">{title}</h3>
      <p className="govuk-body fphd-metadata-text">{text}</p>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="govuk-summary-list__row">
      <dt className="govuk-summary-list__key">{label}</dt>
      <dd className="govuk-summary-list__value">{value}</dd>
    </div>
  );
}

function SourceRow({ label, source }: { label: string; source: IndicatorDetail['dataSource'] }) {
  if (!source) {
    return null;
  }

  return (
    <div className="govuk-summary-list__row">
      <dt className="govuk-summary-list__key">{label}</dt>
      <dd className="govuk-summary-list__value">
        {source.url ? <A href={source.url}>{source.name}</A> : source.name}
      </dd>
    </div>
  );
}

export function IndicatorPage({ indicator }: { indicator: IndicatorDetail }) {
  const hasAbout =
    indicator.rationale ||
    indicator.methodology ||
    indicator.numeratorDefinition ||
    indicator.denominatorDefinition ||
    indicator.disclosureControl ||
    indicator.caveats ||
    indicator.notes;
  const hasSources =
    indicator.dataSource || indicator.numeratorSource || indicator.denominatorSource;

  return (
    <PageIntro title={indicator.name}>
      {indicator.definition ? (
        <p className="govuk-body-l fphd-metadata-text">{indicator.definition}</p>
      ) : null}

      <h2 className="govuk-heading-l">Data</h2>
      <ChartPlaceholder
        title="Trend over time"
        description="How this indicator has changed over time."
      />
      <ChartPlaceholder
        title="Compare areas"
        description="How areas compare with each other for the latest time period."
      />
      <ChartPlaceholder
        title="Compare with England"
        description="How an area compares with the England value."
      />

      {hasAbout ? (
        <>
          <h2 className="govuk-heading-l">About this indicator</h2>
          <MetadataSection title="Rationale" text={indicator.rationale} />
          <MetadataSection title="Methodology" text={indicator.methodology} />
          <MetadataSection title="Numerator" text={indicator.numeratorDefinition} />
          <MetadataSection title="Denominator" text={indicator.denominatorDefinition} />
          <MetadataSection title="Disclosure control" text={indicator.disclosureControl} />
          <MetadataSection title="Caveats" text={indicator.caveats} />
          <MetadataSection title="Notes" text={indicator.notes} />
        </>
      ) : null}

      {hasSources ? (
        <>
          <h2 className="govuk-heading-l">Data sources</h2>
          <dl className="govuk-summary-list">
            <SourceRow label="Data source" source={indicator.dataSource} />
            <SourceRow label="Numerator source" source={indicator.numeratorSource} />
            <SourceRow label="Denominator source" source={indicator.denominatorSource} />
          </dl>
        </>
      ) : null}

      <h2 className="govuk-heading-l">Technical details</h2>
      <dl className="govuk-summary-list">
        <SummaryRow label="Value type" value={indicator.valueType} />
        <SummaryRow label="Unit" value={indicator.unit.name} />
        <SummaryRow label="Year type" value={indicator.yearType} />
        <SummaryRow label="Frequency" value={indicator.frequency} />
        <SummaryRow label="Polarity" value={indicator.polarity} />
        <SummaryRow label="Confidence interval method" value={indicator.ciMethod} />
        <SummaryRow
          label="Confidence level"
          value={
            indicator.ciConfidenceLevel
              ? (CONFIDENCE_LEVEL_LABELS[indicator.ciConfidenceLevel] ??
                indicator.ciConfidenceLevel)
              : null
          }
        />
      </dl>
    </PageIntro>
  );
}

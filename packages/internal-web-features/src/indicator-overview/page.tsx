import { A, BackLink, GridColumn, GridRow, SummaryList, Tabs, Tag } from '@fphd/ui';

import { DASHBOARD_PATH } from '../dashboard/paths.ts';
import type { IndicatorAdminDetail, IndicatorStatus } from './loader.ts';
import { publishedIndicatorPath } from './paths.ts';

const STATUS_TAGS: Record<IndicatorStatus, { label: string; colour: string }> = {
  draft: { label: 'Draft', colour: 'grey' },
  published: { label: 'Published', colour: 'green' },
};

function StatusTag({ status }: { status: IndicatorStatus }) {
  const { label, colour } = STATUS_TAGS[status];

  return <Tag classModifiers={colour} text={label} />;
}

// Only a published indicator has a public page; a draft has nothing to act on yet.
function Actions({ indicator }: { indicator: IndicatorAdminDetail }) {
  return (
    <>
      <h2 className="govuk-heading-m">Actions</h2>
      {indicator.publishedSlug !== null ? (
        <ul className="govuk-list">
          <li>
            <A href={publishedIndicatorPath(indicator.publishedSlug)}>View published indicator</A>
          </li>
        </ul>
      ) : (
        <p className="govuk-body">There are no actions available for this indicator yet.</p>
      )}
    </>
  );
}

export function IndicatorOverviewPage({ indicator }: { indicator: IndicatorAdminDetail }) {
  return (
    <>
      <BackLink href={DASHBOARD_PATH}>Back to indicators</BackLink>
      <GridRow>
        <GridColumn width="two-thirds">
          <h1 className="govuk-heading-xl">{indicator.name}</h1>
          <SummaryList
            items={[
              { name: 'Indicator number', children: String(indicator.shortId) },
              { name: 'Status', children: <StatusTag status={indicator.status} /> },
            ]}
          />
          <Tabs
            items={[
              { id: 'actions', label: 'Actions', content: <Actions indicator={indicator} /> },
            ]}
            paramKey="tab"
          />
        </GridColumn>
      </GridRow>
    </>
  );
}

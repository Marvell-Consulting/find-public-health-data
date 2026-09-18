import { A, BackLink, GridColumn, GridRow, SummaryList, Tabs, Tag } from '@fphd/ui';

import { DASHBOARD_PATH } from '../dashboard/paths';
import type { IndicatorAdminDetail, IndicatorStatus } from './loader';
import { publishedIndicatorPath } from './paths';

const STATUS_TAGS: Record<IndicatorStatus, { label: string; colour: string }> = {
  draft: { label: 'Draft', colour: 'grey' },
  in_review: { label: 'In review', colour: 'yellow' },
  approved: { label: 'Approved', colour: 'green' },
  archived: { label: 'Archived', colour: 'grey' },
};

function StatusTag({ status }: { status: IndicatorStatus }) {
  const { label, colour } = STATUS_TAGS[status];

  return <Tag classModifiers={colour} text={label} />;
}

// Only an approved indicator has a public page; the rest have nothing to act on yet.
function Actions({ indicator }: { indicator: IndicatorAdminDetail }) {
  return (
    <>
      <h2 className="govuk-heading-m">Actions</h2>
      {indicator.status === 'approved' ? (
        <ul className="govuk-list">
          <li>
            <A href={publishedIndicatorPath(indicator.shortId)}>View published indicator</A>
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
              { name: 'Indicator ID', children: String(indicator.shortId) },
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

import { A, GridColumn, GridRow, SummaryList, Tabs, Tag } from '@fphd/ui';

import { indicatorTaskListPath } from '../indicator-task-list/paths.ts';
import type { IndicatorAdminDetail, IndicatorStatus } from './loader.ts';
import { publishedIndicatorPath } from './paths.ts';

const STATUS_TAGS: Record<IndicatorStatus, { label: string; colour: string }> = {
  draft: { label: 'Incomplete', colour: 'grey' },
  published: { label: 'Published', colour: 'green' },
};

function StatusTag({ status }: { status: IndicatorStatus }) {
  const { label, colour } = STATUS_TAGS[status];

  return <Tag classModifiers={colour} text={label} />;
}

// A draft is edited from its task list; an indicator with a published version has a public page, draft or not.
function Actions({ indicator }: { indicator: IndicatorAdminDetail }) {
  const actions = [
    indicator.status === 'draft'
      ? { href: indicatorTaskListPath(indicator.id), label: 'Continue creating indicator' }
      : undefined,
    indicator.publishedSlug === null
      ? undefined
      : {
          href: publishedIndicatorPath(indicator.publishedSlug),
          label: 'View published indicator',
        },
  ].filter((action) => action !== undefined);

  return (
    <>
      <h2 className="govuk-heading-m">Actions</h2>
      {actions.length > 0 ? (
        <ul className="govuk-list">
          {actions.map(({ href, label }) => (
            <li key={href}>
              <A href={href}>{label}</A>
            </li>
          ))}
        </ul>
      ) : (
        <p className="govuk-body">There are no actions available for this indicator yet.</p>
      )}
    </>
  );
}

export function IndicatorOverviewPage({ indicator }: { indicator: IndicatorAdminDetail }) {
  return (
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
          items={[{ id: 'actions', label: 'Actions', content: <Actions indicator={indicator} /> }]}
          paramKey="tab"
        />
      </GridColumn>
    </GridRow>
  );
}

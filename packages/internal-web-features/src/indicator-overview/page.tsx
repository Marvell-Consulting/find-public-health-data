import { A, GridColumn, GridRow, SummaryList, Tabs } from '@fphd/ui';

import { indicatorTaskListPath } from '../indicator-task-list/paths.ts';
import { StatusTag } from '../status-tag/status-tag.tsx';
import type { IndicatorAdminDetail } from './loader.ts';
import { publishedIndicatorPath } from './paths.ts';

// A draft is edited from its task list; an indicator with a published version has a public page, draft or not.
function Actions({ indicator }: { indicator: IndicatorAdminDetail }) {
  const actions = [
    indicator.draftStatus === null
      ? undefined
      : { href: indicatorTaskListPath(indicator.id), label: 'Continue creating indicator' },
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
            {
              name: 'Indicator status',
              children: <StatusTag type="indicator" status={indicator.indicatorStatus} />,
            },
            {
              name: 'Publishing status',
              children: (
                <StatusTag
                  type="publishing"
                  indicatorStatus={indicator.indicatorStatus}
                  draftStatus={indicator.draftStatus}
                />
              ),
            },
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

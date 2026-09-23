import { A, GridColumn, GridRow, Tabs } from '@fphd/ui';

import { indicatorTaskListPath } from '../indicator-task-list/paths.ts';
import { IndicatorHeading } from '../status-tag/indicator-heading.tsx';
import type { IndicatorAdminDetail } from './loader.ts';
import { publishedIndicatorPath } from './paths.ts';

// A draft is edited from its task list; an indicator with a published version has a public page, draft or not.
function Actions({ indicator }: { indicator: IndicatorAdminDetail }) {
  const actions = [
    indicator.draftStatus === null
      ? undefined
      : {
          href: indicatorTaskListPath(indicator.id),
          label:
            indicator.indicatorStatus === 'live'
              ? 'Continue updating indicator'
              : 'Continue creating indicator',
        },
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
        <IndicatorHeading {...indicator} />
        <Tabs
          items={[{ id: 'actions', label: 'Actions', content: <Actions indicator={indicator} /> }]}
          paramKey="tab"
        />
      </GridColumn>
    </GridRow>
  );
}

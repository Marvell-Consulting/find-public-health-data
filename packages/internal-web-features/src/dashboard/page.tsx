import { formatDate, GridColumn, GridRow, Pagination, Table } from '@fphd/ui';

import type { IndicatorAdminSummary } from './loader';
import { dashboardPath } from './paths';

// Plain anchors: the router-aware link would also mark every link to the bare path as current.
function pageLink(number: number, current: number) {
  return {
    href: dashboardPath(number),
    forceExternal: true,
    ...(number === current ? { 'aria-current': 'page' as const } : {}),
  };
}

interface DashboardPageProps {
  indicators: IndicatorAdminSummary[];
  page: number;
  totalPages: number;
}

export function DashboardPage({ indicators, page, totalPages }: DashboardPageProps) {
  return (
    <GridRow>
      <GridColumn width="full">
        <h1 className="govuk-heading-xl">Indicators</h1>
        {indicators.length === 0 ? (
          <p className="govuk-body">There are no indicators yet.</p>
        ) : (
          <Table
            caption="All indicators, most recently edited first"
            headings={{
              name: 'Indicator name',
              updatedAt: 'Last edited',
              indicatorStatus: 'Indicator status',
              publishingStatus: 'Publishing status',
            }}
            keys={['name', 'updatedAt', 'indicatorStatus', 'publishingStatus']}
            data={indicators.map((indicator) => ({
              name: indicator.name,
              updatedAt: (
                <time dateTime={indicator.updatedAt}>{formatDate(indicator.updatedAt)}</time>
              ),
              indicatorStatus: '',
              publishingStatus: '',
            }))}
          />
        )}
        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            landmarkLabel="Pagination"
            links={Array.from({ length: totalPages }, (_, index) => pageLink(index + 1, page))}
          />
        ) : null}
      </GridColumn>
    </GridRow>
  );
}

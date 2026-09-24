import { A, Button, formatDate, GridColumn, GridRow, Pagination, Table } from '@fphd/ui';
import { indicatorOverviewPath } from '../indicator-overview/paths.ts';
import { NEW_INDICATOR_PATH } from '../publish-paths.ts';
import { StatusTag } from '../status-tag/status-tag.tsx';
import type { IndicatorAdminSummary } from './loader.ts';
import { dashboardPath } from './paths.ts';

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
        <Button href={NEW_INDICATOR_PATH}>Create new indicator</Button>
        {indicators.length === 0 ? (
          <p className="govuk-body">There are no indicators yet.</p>
        ) : (
          <Table
            aria-label="Every indicator, most recently edited first"
            headings={{
              name: 'Indicator name',
              updatedAt: 'Last edited',
              indicatorStatus: 'Indicator status',
              publishingStatus: 'Publishing status',
            }}
            keys={['name', 'updatedAt', 'indicatorStatus', 'publishingStatus']}
            data={indicators.map((indicator) => ({
              // The first column is a row header, which GOV.UK sets bold; the names read as
              // plain text.
              name: (
                <span className="govuk-!-font-weight-regular">
                  <A href={indicatorOverviewPath(indicator.id)}>{indicator.name}</A>
                </span>
              ),
              updatedAt: (
                <time dateTime={indicator.updatedAt}>{formatDate(indicator.updatedAt)}</time>
              ),
              // The column headers name the statuses, and screen readers announce them per cell.
              indicatorStatus: (
                <StatusTag type="indicator" status={indicator.indicatorStatus} labelled={false} />
              ),
              publishingStatus: (
                <StatusTag
                  type="publishing"
                  indicatorStatus={indicator.indicatorStatus}
                  draftStatus={indicator.draftStatus}
                  labelled={false}
                />
              ),
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

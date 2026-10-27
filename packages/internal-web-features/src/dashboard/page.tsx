import { Button, GridColumn, GridRow, Pagination, Table } from '@fphd/ui';
import { NEW_INDICATOR_PATH } from '../publish-paths.ts';
import { INDICATOR_HEADINGS, INDICATOR_KEYS, indicatorCells } from './indicator-cells.tsx';
import type { IndicatorAdminListItem } from './loader.ts';
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
  canCreate: boolean;
  indicators: IndicatorAdminListItem[];
  page: number;
  totalPages: number;
}

export function DashboardPage({ canCreate, indicators, page, totalPages }: DashboardPageProps) {
  return (
    <GridRow>
      <GridColumn width="full">
        <h1 className="govuk-heading-xl">Indicators</h1>
        {canCreate ? <Button href={NEW_INDICATOR_PATH}>Create new indicator</Button> : null}
        {indicators.length === 0 ? (
          <p className="govuk-body">There are no indicators for you to see yet.</p>
        ) : (
          <Table
            aria-label="Indicators, most recently edited first"
            headings={INDICATOR_HEADINGS}
            keys={INDICATOR_KEYS}
            data={indicators.map(indicatorCells)}
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

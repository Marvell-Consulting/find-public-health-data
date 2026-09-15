import { DASHBOARD_PATH } from '../dashboard/paths';

export function indicatorOverviewPath(id: string): string {
  return `${DASHBOARD_PATH}/indicators/${encodeURIComponent(id)}`;
}

/** The public page for an approved indicator, which the internal app serves too. */
export function publishedIndicatorPath(fingertipsId: number): string {
  return `/indicators/${fingertipsId}`;
}

import { DASHBOARD_PATH } from '../dashboard/paths.ts';

export function indicatorOverviewPath(id: string): string {
  return `${DASHBOARD_PATH}/indicators/${encodeURIComponent(id)}`;
}

/** The public page for a published indicator, which the internal app serves too. */
export function publishedIndicatorPath(slug: string): string {
  return `/indicators/${encodeURIComponent(slug)}`;
}

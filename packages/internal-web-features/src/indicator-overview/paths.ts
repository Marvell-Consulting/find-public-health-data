import { DASHBOARD_PATH } from '../dashboard/paths.ts';

export function indicatorOverviewPath(id: string): string {
  return `${DASHBOARD_PATH}/indicators/${encodeURIComponent(id)}`;
}

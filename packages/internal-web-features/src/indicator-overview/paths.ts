import { DASHBOARD_PATH } from '../dashboard/paths.ts';

export function indicatorOverviewPath(id: string): string {
  return `${DASHBOARD_PATH}/indicators/${encodeURIComponent(id)}`;
}

/** Where an IMRG manager assigns the reviewers of the draft's submission, or changes them. */
export function indicatorAssignReviewersPath(id: string): string {
  return `${indicatorOverviewPath(id)}/assign-reviewers`;
}
